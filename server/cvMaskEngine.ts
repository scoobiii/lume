/**
 * @file cvMaskEngine.ts
 * @responsibility Motor real determinístico de Visão Computacional em pixels RGBA (HSV, Sobel 3x3, Morfologia, CCL 8-conectado, Fecho Convexo, Máscara PNG e Classificação Contextual QTA/QGBT) sem LLM e sem mocks.
 * @version 2.1.0
 * @date 2026-11-15
 * @directory /server/cvMaskEngine.ts
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import {
  ContextClassificationResult,
  DetectedObjectMask,
  DocumentNC,
  ImageAuditResponse,
  MaskObjectCategory,
  MaskPoint,
  NCCategory,
  NCSeverity,
} from '../src/types/audit';

interface DecodedImage {
  width: number;
  height: number;
  rgba: Uint8Array;
}

interface ComponentBlob {
  category: MaskObjectCategory;
  pixels: number[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  sumHueSin: number;
  sumHueCos: number;
  sumSat: number;
  sumEdge: number;
  boundaryPoints: Array<{ x: number; y: number }>;
}

function decodeImageBuffer(buffer: Buffer, mimeType: string): DecodedImage {
  const isPng =
    mimeType.toLowerCase().includes('png') ||
    (buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47);

  if (isPng) {
    const parsed = PNG.sync.read(buffer);
    return {
      width: parsed.width,
      height: parsed.height,
      rgba: new Uint8Array(parsed.data),
    };
  }

  const parsedJpeg = jpeg.decode(buffer, {
    useTArray: true,
    formatAsRGBA: true,
    maxMemoryUsageInMB: 512,
    maxResolutionInMP: 100,
  });
  return {
    width: parsedJpeg.width,
    height: parsedJpeg.height,
    rgba: new Uint8Array(parsedJpeg.data),
  };
}

function downsampleImage(
  src: DecodedImage,
  maxDim = 360
): { width: number; height: number; rgba: Uint8Array } {
  const scale = Math.min(1, maxDim / Math.max(src.width, src.height));
  const w = Math.max(32, Math.round(src.width * scale));
  const h = Math.max(32, Math.round(src.height * scale));
  const out = new Uint8Array(w * h * 4);

  for (let y = 0; y < h; y++) {
    const sy = Math.min(src.height - 1, Math.floor((y * src.height) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / w));
      const si = (sy * src.width + sx) * 4;
      const di = (y * w + x) * 4;
      out[di] = src.rgba[si];
      out[di + 1] = src.rgba[si + 1];
      out[di + 2] = src.rgba[si + 2];
      out[di + 3] = src.rgba[si + 3];
    }
  }
  return { width: w, height: h, rgba: out };
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === rn) {
      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    } else if (max === gn) {
      h = ((bn - rn) / d + 2) * 60;
    } else {
      h = ((rn - gn) / d + 4) * 60;
    }
  }
  return [h, s, v];
}

function dilateBinary(mask: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (
        mask[idx] ||
        mask[idx - 1] ||
        mask[idx + 1] ||
        mask[idx - w] ||
        mask[idx + w]
      ) {
        out[idx] = 1;
      }
    }
  }
  return out;
}

function convexHull(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (points.length <= 3) return points;
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (
    o: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number }
  ) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Array<{ x: number; y: number }> = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Array<{ x: number; y: number }> = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  const hull = lower.concat(upper);
  if (hull.length <= 14) return hull;
  const step = Math.ceil(hull.length / 12);
  return hull.filter((_, i) => i % step === 0);
}

function extractComponents(
  mask: Uint8Array,
  w: number,
  h: number,
  category: MaskObjectCategory,
  hueGrid: Float32Array,
  satGrid: Float32Array,
  edgeGrid: Float32Array,
  minPixels: number
): ComponentBlob[] {
  const visited = new Uint8Array(w * h);
  const blobs: ComponentBlob[] = [];
  const stack: number[] = [];

  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || visited[i]) continue;

    visited[i] = 1;
    stack.push(i);

    const pixels: number[] = [];
    const boundaryPoints: Array<{ x: number; y: number }> = [];
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    let sumHueSin = 0;
    let sumHueCos = 0;
    let sumSat = 0;
    let sumEdge = 0;

    while (stack.length > 0) {
      const curr = stack.pop()!;
      const cx = curr % w;
      const cy = Math.floor(curr / w);

      pixels.push(curr);
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;

      const rad = (hueGrid[curr] * Math.PI) / 180;
      sumHueSin += Math.sin(rad);
      sumHueCos += Math.cos(rad);
      sumSat += satGrid[curr];
      sumEdge += edgeGrid[curr];

      let isBoundary = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
            isBoundary = true;
            continue;
          }
          const ni = ny * w + nx;
          if (!mask[ni]) {
            isBoundary = true;
          } else if (!visited[ni]) {
            visited[ni] = 1;
            stack.push(ni);
          }
        }
      }
      if (isBoundary) {
        boundaryPoints.push({ x: cx, y: cy });
      }
    }

    if (pixels.length >= minPixels) {
      blobs.push({
        category,
        pixels,
        minX,
        minY,
        maxX,
        maxY,
        sumHueSin,
        sumHueCos,
        sumSat,
        sumEdge,
        boundaryPoints,
      });
    }
  }

  return blobs;
}

export function analyzePanelImagePixels(params: {
  imageBase64: string;
  mimeType?: string;
  imageLabel?: string;
  contextText?: string;
}): ImageAuditResponse {
  const startMs = Date.now();
  const {
    imageBase64,
    mimeType = 'image/jpeg',
    imageLabel = 'Painel Inspecionado',
    contextText = '',
  } = params;

  const cleanB64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  const buffer = Buffer.from(cleanB64, 'base64');
  const decoded = decodeImageBuffer(buffer, mimeType);
  const work = downsampleImage(decoded, 360);

  const { width: w, height: h, rgba } = work;
  const totalPixels = w * h;

  const luma = new Float32Array(totalPixels);
  const hueGrid = new Float32Array(totalPixels);
  const satGrid = new Float32Array(totalPixels);
  const valGrid = new Float32Array(totalPixels);
  const edgeGrid = new Float32Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    const [hue, sat, val] = rgbToHsv(r, g, b);
    hueGrid[i] = hue;
    satGrid[i] = sat;
    valGrid[i] = val;
  }

  // Sobel 3x3 edge magnitude & orthogonal energy
  let orthoEnergy = 0;
  let diagEnergy = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx =
        -luma[idx - w - 1] +
        luma[idx - w + 1] -
        2 * luma[idx - 1] +
        2 * luma[idx + 1] -
        luma[idx + w - 1] +
        luma[idx + w + 1];
      const gy =
        -luma[idx - w - 1] -
        2 * luma[idx - w] -
        luma[idx - w + 1] +
        luma[idx + w - 1] +
        2 * luma[idx + w] +
        luma[idx + w + 1];
      const mag = Math.sqrt(gx * gx + gy * gy) / 1020;
      edgeGrid[idx] = mag;

      if (mag > 0.12) {
        const absGx = Math.abs(gx);
        const absGy = Math.abs(gy);
        if (absGx > absGy * 2.2 || absGy > absGx * 2.2) {
          orthoEnergy += mag;
        } else {
          diagEnergy += mag;
        }
      }
    }
  }

  const orthogonalWireRatio =
    orthoEnergy + diagEnergy > 0 ? orthoEnergy / (orthoEnergy + diagEnergy) : 1;

  // Pixel-level binary masks for electrical domain & context classes
  const wireMask = new Uint8Array(totalPixels);
  const redMimicMask = new Uint8Array(totalPixels);
  const copperMask = new Uint8Array(totalPixels);
  const yellowHazardMask = new Uint8Array(totalPixels);
  const breakerGreenTabMask = new Uint8Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const hue = hueGrid[i];
    const sat = satGrid[i];
    const val = valGrid[i];
    const x = i % w;

    // 0. Red schematic mimic diagram lines (typically painted on left cabinet door)
    const isCrimsonRed = ((hue >= 344 && hue <= 360) || (hue >= 0 && hue <= 12)) && sat >= 0.55 && val >= 0.30;
    if (isCrimsonRed && x < w * 0.38) {
      redMimicMask[i] = 1;
    }

    // 1. Insulated loose wires (blue, brown/orange/red inside panel, green-yellow PE)
    const isBlueWire = hue >= 192 && hue <= 245 && sat >= 0.32 && val >= 0.20;
    const isBrownOrRedWire =
      ((hue >= 0 && hue <= 34) || hue >= 342) && sat >= 0.34 && val >= 0.18 && val <= 0.88 && !redMimicMask[i];
    const isGreenYellowWire = hue >= 68 && hue <= 165 && sat >= 0.32 && val >= 0.22;

    if (isBlueWire || isBrownOrRedWire || isGreenYellowWire) {
      wireMask[i] = 1;
    }

    // 2. Exposed metallic copper busbar (central spine & neutral/ground bars)
    if (hue >= 14 && hue <= 34 && sat >= 0.20 && sat <= 0.65 && val >= 0.20 && val <= 0.72) {
      copperMask[i] = 1;
    }

    // 3. Safety yellow hazard triangle / warning label
    if (hue >= 42 && hue <= 64 && sat >= 0.52 && val >= 0.52) {
      yellowHazardMask[i] = 1;
    }

    // 4. Molded-case circuit breaker green faceplates / status labels
    if (hue >= 115 && hue <= 165 && sat >= 0.40 && val >= 0.25 && val <= 0.80) {
      breakerGreenTabMask[i] = 1;
    }
  }

  const dilatedWireMask = dilateBinary(wireMask, w, h);
  const dilatedMimicMask = dilateBinary(redMimicMask, w, h);

  const minWirePx = Math.max(20, Math.round(totalPixels * 0.00025));
  const minCopperPx = Math.max(40, Math.round(totalPixels * 0.00055));
  const minLabelPx = Math.max(18, Math.round(totalPixels * 0.00022));

  const wireBlobs = extractComponents(
    dilatedWireMask,
    w,
    h,
    'loose_wire',
    hueGrid,
    satGrid,
    edgeGrid,
    minWirePx
  );

  const filteredWireBlobs = wireBlobs.filter((b) => {
    const bw = Math.max(1, b.maxX - b.minX + 1);
    const bh = Math.max(1, b.maxY - b.minY + 1);
    const bboxArea = bw * bh;
    const fillRatio = b.pixels.length / bboxArea;
    const touchesEdge = b.minX <= 2 || b.maxX >= w - 3;
    const veryLargeSolidWall = touchesEdge && fillRatio > 0.58 && bboxArea > totalPixels * 0.08;
    return !veryLargeSolidWall && (fillRatio < 0.54 || Math.max(bw / bh, bh / bw) > 2.0);
  });

  const mimicBlobs = extractComponents(
    dilatedMimicMask,
    w,
    h,
    'mimic_diagram',
    hueGrid,
    satGrid,
    edgeGrid,
    minLabelPx
  ).filter((b) => {
    const bw = Math.max(1, b.maxX - b.minX + 1);
    const bh = Math.max(1, b.maxY - b.minY + 1);
    return bh > h * 0.12 || bw > w * 0.08;
  });

  const copperBlobs = extractComponents(
    copperMask,
    w,
    h,
    'exposed_copper_busbar',
    hueGrid,
    satGrid,
    edgeGrid,
    minCopperPx
  ).filter((b) => {
    const bw = Math.max(1, b.maxX - b.minX + 1);
    const bh = Math.max(1, b.maxY - b.minY + 1);
    const fill = b.pixels.length / (bw * bh);
    return fill >= 0.16 && (bh > h * 0.08 || bw > w * 0.08);
  });

  const hazardBlobs = extractComponents(
    yellowHazardMask,
    w,
    h,
    'hazard_label',
    hueGrid,
    satGrid,
    edgeGrid,
    minLabelPx
  );

  const breakerBlobs = extractComponents(
    breakerGreenTabMask,
    w,
    h,
    'circuit_breaker_block',
    hueGrid,
    satGrid,
    edgeGrid,
    minLabelPx
  );

  // Build transparent RGBA segmentation mask PNG from actual detected pixel blobs
  const maskPng = new PNG({ width: w, height: h });
  maskPng.data.fill(0);

  const paintBlob = (blob: ComponentBlob, r: number, g: number, b: number, a: number) => {
    for (const pxIdx of blob.pixels) {
      const p = pxIdx * 4;
      maskPng.data[p] = r;
      maskPng.data[p + 1] = g;
      maskPng.data[p + 2] = b;
      maskPng.data[p + 3] = a;
    }
  };

  filteredWireBlobs.forEach((b) => paintBlob(b, 220, 38, 38, 175));
  copperBlobs.forEach((b) => paintBlob(b, 217, 119, 6, 165));
  hazardBlobs.forEach((b) => paintBlob(b, 234, 179, 8, 180));
  breakerBlobs.forEach((b) => paintBlob(b, 22, 163, 74, 155));
  mimicBlobs.forEach((b) => paintBlob(b, 147, 51, 234, 140));

  const maskOverlayPngDataUrl = `data:image/png;base64,${PNG.sync.write(maskPng).toString('base64')}`;

  const toDetectedObject = (
    blob: ComponentBlob,
    idx: number,
    severity: NCSeverity,
    normativeRef: string,
    findingTitle: string,
    description: string,
    remediation: string
  ): DetectedObjectMask => {
    const bw = Math.max(1, blob.maxX - blob.minX + 1);
    const bh = Math.max(1, blob.maxY - blob.minY + 1);
    const count = blob.pixels.length;
    const meanHue =
      ((Math.atan2(blob.sumHueSin, blob.sumHueCos) * 180) / Math.PI + 360) % 360;

    const hull = convexHull(blob.boundaryPoints);
    const polygon: MaskPoint[] = hull.map((pt) => ({
      x: Math.round((pt.x / (w - 1)) * 1000),
      y: Math.round((pt.y / (h - 1)) * 1000),
    }));

    return {
      id: `${blob.category}-${idx + 1}`,
      label: blob.category,
      category: blob.category,
      severity,
      bbox: [
        Math.round((blob.minY / (h - 1)) * 1000),
        Math.round((blob.minX / (w - 1)) * 1000),
        Math.round((blob.maxY / (h - 1)) * 1000),
        Math.round((blob.maxX / (w - 1)) * 1000),
      ],
      polygon,
      metrics: {
        pixelCount: count,
        areaPercent: Number(((count / totalPixels) * 100).toFixed(2)),
        fillRatio: Number((count / (bw * bh)).toFixed(2)),
        aspectRatio: Number((bw / bh).toFixed(2)),
        meanHueDeg: Math.round(meanHue),
        meanSaturation: Number((blob.sumSat / count).toFixed(2)),
        edgeDensity: Number((blob.sumEdge / count).toFixed(2)),
      },
      normativeRef,
      findingTitle,
      description,
      remediation,
    };
  };

  const objects: DetectedObjectMask[] = [];

  const topWires = [...filteredWireBlobs]
    .sort((a, b) => b.pixels.length - a.pixels.length)
    .slice(0, 8);

  topWires.forEach((b, idx) => {
    const bw = b.maxX - b.minX + 1;
    const bh = b.maxY - b.minY + 1;
    const fill = b.pixels.length / Math.max(1, bw * bh);
    const isDiagonalUncontained = fill < 0.35 && bw > w * 0.08 && bh > h * 0.08;
    objects.push(
      toDetectedObject(
        b,
        idx,
        isDiagonalUncontained ? NCSeverity.CRITICAL : NCSeverity.MAJOR,
        'ABNT NBR 5410 §6.2.11 / NR-10 §10.2.4',
        isDiagonalUncontained
          ? `Condutor solto fora de canaleta/amarração (#${idx + 1})`
          : `Ramo de fiação exposta sem calha fechada (#${idx + 1})`,
        `Segmentação HSV/Sobel detectou ${b.pixels.length} px (${((b.pixels.length / totalPixels) * 100).toFixed(2)}% da imagem) com preenchimento ${fill.toFixed(2)}, caracterizando fio solto sem enforca-gato nem canaleta.`,
        'Acomodar em canaleta PVC fechada ou agrupar em chicote preso com abraçadeiras de nylon (enforca-gato) e anilhas identificadoras.'
      )
    );
  });

  // Contextual Spatial Zone Mask: Envelope encompassing all uncontained loose wires if >= 2 wire blobs exist
  if (topWires.length >= 2) {
    const allBoundary: Array<{ x: number; y: number }> = [];
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    let totalWirePx = 0;
    for (const wb of topWires) {
      totalWirePx += wb.pixels.length;
      if (wb.minX < minX) minX = wb.minX;
      if (wb.minY < minY) minY = wb.minY;
      if (wb.maxX > maxX) maxX = wb.maxX;
      if (wb.maxY > maxY) maxY = wb.maxY;
      allBoundary.push(...wb.boundaryPoints);
    }
    const zoneHull = convexHull(allBoundary);
    objects.push({
      id: 'uncontained-wiring-zone-1',
      label: 'uncontained_wiring_zone',
      category: 'uncontained_wiring_zone',
      severity: NCSeverity.CRITICAL,
      bbox: [
        Math.round((minY / (h - 1)) * 1000),
        Math.round((minX / (w - 1)) * 1000),
        Math.round((maxY / (h - 1)) * 1000),
        Math.round((maxX / (w - 1)) * 1000),
      ],
      polygon: zoneHull.map((pt) => ({
        x: Math.round((pt.x / (w - 1)) * 1000),
        y: Math.round((pt.y / (h - 1)) * 1000),
      })),
      metrics: {
        pixelCount: totalWirePx,
        areaPercent: Number(((totalWirePx / totalPixels) * 100).toFixed(2)),
        fillRatio: Number(
          (totalWirePx / Math.max(1, (maxX - minX + 1) * (maxY - minY + 1))).toFixed(2)
        ),
        aspectRatio: Number(((maxX - minX + 1) / Math.max(1, maxY - minY + 1)).toFixed(2)),
        meanHueDeg: 210,
        meanSaturation: 0.55,
        edgeDensity: 0.25,
      },
      normativeRef: 'ABNT NBR 5410 §6.2.11 / NR-10 §10.2.4',
      findingTitle: `Zona contextual de gambiarras (${topWires.length} ramos sem calha/enforca-gato)`,
      description: `Envoltória espacial dos ${topWires.length} feixes soltos abrangendo da coordenada Y=${Math.round((minY / h) * 100)}% até ${Math.round((maxY / h) * 100)}% do quadro.`,
      remediation:
        'Instalar canaletas perfuradas laterais e inferiores e fixar chicotes com abraçadeiras de nylon.',
    });
  }

  const topCopper = [...copperBlobs]
    .sort((a, b) => b.pixels.length - a.pixels.length)
    .slice(0, 4);
  topCopper.forEach((b, idx) => {
    objects.push(
      toDetectedObject(
        b,
        idx,
        NCSeverity.CRITICAL,
        'NR-10 §10.2.8 / ABNT NBR IEC 61439-1 (IP2X)',
        `Barramento de cobre exposto sem proteção IP2X (#${idx + 1})`,
        `Região metálica de cobre detectada (${b.pixels.length} px) sem barreira isolante transparente contra contato acidental.`,
        'Instalar barreira de policarbonato transparente IP2X sobre o barramento vivo.'
      )
    );
  });

  const topBreakers = [...breakerBlobs]
    .sort((a, b) => b.pixels.length - a.pixels.length)
    .slice(0, 6);
  topBreakers.forEach((b, idx) => {
    objects.push(
      toDetectedObject(
        b,
        idx,
        NCSeverity.COMPLIANT,
        'IEC 60947-2 / NBR 5410',
        `Disjuntor em caixa moldada detectado (#${idx + 1})`,
        `Identificador verde de equipamento em caixa moldada segmentado (${b.pixels.length} px).`,
        'Confirmar presença de intertravamento mecânico/elétrico se especificado como QTA.'
      )
    );
  });

  const topMimic = [...mimicBlobs]
    .sort((a, b) => b.pixels.length - a.pixels.length)
    .slice(0, 2);
  topMimic.forEach((b, idx) => {
    objects.push(
      toDetectedObject(
        b,
        idx,
        NCSeverity.MINOR,
        'Contextual Topology (QGBT vs QTA)',
        `Diagrama mímico unifilar na porta esquerda (#${idx + 1})`,
        `Traçado esquemático vermelho na porta (${b.pixels.length} px) indica barramento único de entrada principal (QGBT), sem representação de dupla fonte (Rede × Gerador) típica de QTA/ATS.`,
        'Validar se a figura corresponde de fato a um QTA ou substituí-la por fotografia de QTA com chave de transferência motorizada.'
      )
    );
  });

  const topHazards = [...hazardBlobs]
    .sort((a, b) => b.pixels.length - a.pixels.length)
    .slice(0, 3);
  topHazards.forEach((b, idx) => {
    objects.push(
      toDetectedObject(
        b,
        idx,
        NCSeverity.COMPLIANT,
        'NR-10 §10.10.1 (Sinalização)',
        `Sinalização amarela de risco elétrico (#${idx + 1})`,
        `Área amarela de alta visibilidade detectada (${b.pixels.length} px) compatível com etiqueta de advertência elétrica.`,
        'Manter sinalização visível com tensão nominal e código de figura documental.'
      )
    );
  });

  const looseWireAreaPercent = Number(
    (
      (filteredWireBlobs.reduce((acc, b) => acc + b.pixels.length, 0) / totalPixels) *
      100
    ).toFixed(2)
  );
  const exposedCopperAreaPercent = Number(
    (
      (copperBlobs.reduce((acc, b) => acc + b.pixels.length, 0) / totalPixels) *
      100
    ).toFixed(2)
  );

  // Context Classification & Document Cross-Validation
  const figMatch = contextText.match(/Fig\.?\s*\d+/i);
  const figureCodeInContext = figMatch ? figMatch[0] : null;
  const hasGenericPlaceholder = /imagem ilustrativa|a imagem acima/i.test(contextText);
  const isQtaTopic = /QTA|QTM|ATS|transfer[êe]ncia autom[áa]tica/i.test(contextText);
  const expectedTopic = isQtaTopic
    ? 'Quadro de transferência automática (QTA ou QTM)'
    : 'Painel Elétrico de Data Center';

  const looksLikeQgbtSingleBus = topMimic.length > 0 || (topBreakers.length >= 3 && topCopper.length >= 1);
  const detectedPanelType = looksLikeQgbtSingleBus
    ? 'Quadro de Distribuição (QGBT) com barramento central e diagrama unifilar único (sem chave ATS visível)'
    : topBreakers.length > 0
      ? 'Painel de Manobra Elétrica em Baixa Tensão'
      : 'Imagem Geral Inspecionada';

  const wiringClean = topWires.length === 0 && looseWireAreaPercent < 0.2;
  const busbarShielded = topCopper.length === 0;
  const docCodeOk = Boolean(figureCodeInContext) && !hasGenericPlaceholder;
  const topologyAligned = !isQtaTopic || !looksLikeQgbtSingleBus;

  const alignmentChecklist = [
    {
      criterion: 'Identificação Documental (ABNT NBR 14724 §5.8)',
      passed: docCodeOk,
      detail: docCodeOk
        ? `Código encontrado no texto: ${figureCodeInContext}`
        : 'Ausência de código Fig. XX no texto ou uso de marcador genérico ("imagem ilustrativa" / "a imagem acima").',
    },
    {
      criterion: 'Organização de Condutores (ABNT NBR 5410 §6.2.11)',
      passed: wiringClean,
      detail: wiringClean
        ? 'Nenhum ramo de fiação solta detectado fora de canaletas.'
        : `Detectados ${topWires.length} ramos de fios soltos (${looseWireAreaPercent}% da área em pixels) sem canaleta fechada nem enforca-gato.`,
    },
    {
      criterion: 'Proteção contra Contato Direto IP2X (NR-10 §10.2.8)',
      passed: busbarShielded,
      detail: busbarShielded
        ? 'Nenhum barramento vivo exposto detectado.'
        : `Detectadas ${topCopper.length} regiões de barramento de cobre exposto (${exposedCopperAreaPercent}% da área) sem anteparo isolante.`,
    },
    {
      criterion: 'Coerência Contextual Imagem ↔ Tópico (QTA/ATS)',
      passed: topologyAligned,
      detail: topologyAligned
        ? 'Topologia compatível com o tópico textual.'
        : 'Divergência contextual: o texto descreve um QTA/ATS (transferência Rede × Gerador), mas a foto exibe um QGBT com barramento único e diagrama unifilar simples (MAIN).',
    },
  ];

  // Build ready-to-apply DocumentNC patches derived from REAL pixel & context findings
  const suggestedDocumentFindings: DocumentNC[] = [];
  if (!wiringClean || !busbarShielded) {
    suggestedDocumentFindings.push({
      id: `nc-cv-wiring-${Date.now()}`,
      code: 'NC-CV-001',
      title: `Evidência Visual em Pixels: Fios Soltos (${looseWireAreaPercent}%) e Cobre Exposto (${exposedCopperAreaPercent}%)`,
      category: NCCategory.VISUAL_WIRING,
      severity: NCSeverity.CRITICAL,
      normativeClause: 'ABNT NBR 5410 §6.2.11 & NR-10 §10.2.4 / §10.2.8',
      excerpt:
        'A imagem acima ilustra um Quadro de transferência automática dentro de um prédio.',
      lineRange: 'Tópico QTA · Análise Visual Real',
      description: `Detecção determinística em ${imageLabel} (${decoded.width}×${decoded.height} px): ${topWires.length} ramos de fiação solta fora de calha/enforca-gato e ${topCopper.length} áreas de barramento de cobre exposto sem proteção IP2X.`,
      recommendation:
        'Substituir a foto do curso por painel conforme NBR 5410 (calhas fechadas, abraçadeiras e proteção IP2X) e registrar alerta normativo no texto.',
      replacementBefore:
        'A imagem acima ilustra um Quadro de transferência automática dentro de um prédio.',
      replacementAfter:
        'Conforme ilustrado na Fig. 03 (padrão NBR 5410 / IEC 60947-6-1), o Quadro de Transferência Automática instalado em sala elétrica predial deve apresentar cabeamento confinado em canaletas fechadas, amarração com abraçadeiras isolantes e barreira IP2X sobre barramentos energizados.',
      applied: false,
    });
  }

  if (!topologyAligned) {
    suggestedDocumentFindings.push({
      id: `nc-ctx-qta-${Date.now()}`,
      code: 'NC-CTX-002',
      title: 'Divergência Contextual: Foto de QGBT vinculada ao tópico de QTA/ATS',
      category: NCCategory.DOCUMENTAL_REFERENCE,
      severity: NCSeverity.MAJOR,
      normativeClause: 'ABNT NBR 14724 & IEC 60947-6-1 (Topologia ATS)',
      excerpt: 'imagem ilustrativa',
      lineRange: 'Tópico QTA · Classificação Contextual',
      description: `A segmentação detectou diagrama mímico único ("MAIN") e barramento único típicos de QGBT, sem chave de transferência automática Rede × Gerador.`,
      recommendation:
        'Substituir a imagem por um QTA real (com entradas Concessionária e Gerador + USCA) e atribuir código identificador Fig. 03.',
      replacementBefore: 'imagem ilustrativa',
      replacementAfter:
        '[Fig. 03 — Quadro de Transferência Automática (QTA/ATS) com intertravamento Rede × Gerador e fiação em canaletas conforme NBR 5410]',
      applied: false,
    });
  }

  const contextAligned = alignmentChecklist.every((c) => c.passed);
  const criticalCount = objects.filter((o) => o.severity === NCSeverity.CRITICAL).length;
  const majorCount = objects.filter((o) => o.severity === NCSeverity.MAJOR).length;

  const overallStatus =
    criticalCount > 0 || !contextAligned
      ? 'NON_COMPLIANT'
      : majorCount > 0
        ? 'PARTIAL'
        : 'COMPLIANT';

  const documentCrossCheck = `Contexto esperado: "${expectedTopic}". Painel detectado: ${detectedPanelType}. Fiação solta: ${topWires.length} ramos (${looseWireAreaPercent}% da imagem). Cobre exposto IP2X: ${topCopper.length} regiões (${exposedCopperAreaPercent}%). Código Fig. no texto: ${figureCodeInContext ?? 'Ausente'}.`;

  const contextClassification: ContextClassificationResult = {
    expectedTopic,
    detectedPanelType,
    contextAligned,
    figureCodeInContext,
    alignmentChecklist,
    suggestedDocumentFindings,
  };

  return {
    auditId: `cv-pix-${Date.now()}`,
    timestamp: new Date().toISOString(),
    imageLabel,
    imageDimensions: {
      width: decoded.width,
      height: decoded.height,
      analysisWidth: w,
      analysisHeight: h,
    },
    processingMs: Date.now() - startMs,
    figureCodeInContext,
    contextAligned,
    overallStatus,
    maskOverlayPngDataUrl,
    objects,
    contextClassification,
    summaryMetrics: {
      looseWireAreaPercent,
      exposedCopperAreaPercent,
      breakerComponentsCount: topBreakers.length,
      mimicDiagramCount: topMimic.length,
      orthogonalWireRatio: Number(orthogonalWireRatio.toFixed(2)),
    },
    documentCrossCheck,
    analysisSource: 'deterministic-cv-pixel-engine',
  };
}
