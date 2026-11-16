/**
 * @file QtaLoadSimulator.tsx
 * @responsibility Simulador de Carga QTA/ATS para cálculo de demanda de potência, corrente de projeto, queda de tensão e verificação de ampacidade conforme ABNT NBR 5410.
 * @version 1.0.0
 * @date 2026-11-15
 * @directory /src/components/QtaLoadSimulator.tsx
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  FilePlus2,
  RotateCcw,
} from 'lucide-react';

interface QtaLoadSimulatorProps {
  onAppendTechnicalMemo?: (memoText: string) => void;
}

type SystemPhase = '3F' | '2F' | '1F';
type ConductorMaterial = 'Cu' | 'Al';
type InsulationMethod = 'PVC_B1' | 'XLPE_C' | 'XLPE_D';
type SupplyOrigin = 'SUBSTATION_OR_GEN' | 'UTILITY_LV';

interface ConductorEntry {
  sectionMm2: number;
  // Ampacidade Iz (A) aproximada conforme NBR 5410 Tabelas 36 e 37 (3 condutores carregados / 2 para 1F ajustado)
  cuPvcB1: number;
  cuXlpeC: number;
  cuXlpeD: number;
  alXlpeC: number;
  alXlpeD: number;
}

const NBR5410_CONDUCTORS: ConductorEntry[] = [
  { sectionMm2: 2.5, cuPvcB1: 21, cuXlpeC: 31, cuXlpeD: 29, alXlpeC: 0, alXlpeD: 0 },
  { sectionMm2: 4, cuPvcB1: 28, cuXlpeC: 42, cuXlpeD: 37, alXlpeC: 0, alXlpeD: 0 },
  { sectionMm2: 6, cuPvcB1: 36, cuXlpeC: 54, cuXlpeD: 46, alXlpeC: 0, alXlpeD: 0 },
  { sectionMm2: 10, cuPvcB1: 50, cuXlpeC: 75, cuXlpeD: 61, alXlpeC: 0, alXlpeD: 0 },
  { sectionMm2: 16, cuPvcB1: 68, cuXlpeC: 100, cuXlpeD: 79, alXlpeC: 77, alXlpeD: 61 },
  { sectionMm2: 25, cuPvcB1: 89, cuXlpeC: 127, cuXlpeD: 101, alXlpeC: 97, alXlpeD: 78 },
  { sectionMm2: 35, cuPvcB1: 110, cuXlpeC: 158, cuXlpeD: 122, alXlpeC: 120, alXlpeD: 94 },
  { sectionMm2: 50, cuPvcB1: 134, cuXlpeC: 192, cuXlpeD: 144, alXlpeC: 146, alXlpeD: 112 },
  { sectionMm2: 70, cuPvcB1: 171, cuXlpeC: 246, cuXlpeD: 178, alXlpeC: 187, alXlpeD: 138 },
  { sectionMm2: 95, cuPvcB1: 207, cuXlpeC: 298, cuXlpeD: 211, alXlpeC: 227, alXlpeD: 164 },
  { sectionMm2: 120, cuPvcB1: 239, cuXlpeC: 346, cuXlpeD: 240, alXlpeC: 263, alXlpeD: 186 },
  { sectionMm2: 150, cuPvcB1: 272, cuXlpeC: 399, cuXlpeD: 271, alXlpeC: 304, alXlpeD: 210 },
  { sectionMm2: 185, cuPvcB1: 310, cuXlpeC: 456, cuXlpeD: 304, alXlpeC: 347, alXlpeD: 236 },
  { sectionMm2: 240, cuPvcB1: 364, cuXlpeC: 538, cuXlpeD: 351, alXlpeC: 409, alXlpeD: 272 },
  { sectionMm2: 300, cuPvcB1: 419, cuXlpeC: 621, cuXlpeD: 396, alXlpeC: 471, alXlpeD: 308 },
];

const COMMERCIAL_BREAKERS_A = [
  16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250,
  1600, 2000, 2500,
];

interface PresetScenario {
  id: string;
  label: string;
  phase: SystemPhase;
  voltageV: number;
  installedPowerKw: number;
  demandFactor: number;
  powerFactor: number;
  lengthMeters: number;
  material: ConductorMaterial;
  method: InsulationMethod;
  sectionMm2: number;
  parallelCount: number;
  correctionFactor: number;
  supplyOrigin: SupplyOrigin;
}

const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: 'dc-380-nominal',
    label: 'Data Center 380V · Padrão Conforme',
    phase: '3F',
    voltageV: 380,
    installedPowerKw: 220,
    demandFactor: 0.9,
    powerFactor: 0.95,
    lengthMeters: 45,
    material: 'Cu',
    method: 'XLPE_C',
    sectionMm2: 120,
    parallelCount: 2,
    correctionFactor: 0.88,
    supplyOrigin: 'SUBSTATION_OR_GEN',
  },
  {
    id: 'dc-220-noncompliant',
    label: 'QTA 220V · Subdimensionado (NC)',
    phase: '3F',
    voltageV: 220,
    installedPowerKw: 140,
    demandFactor: 0.95,
    powerFactor: 0.85,
    lengthMeters: 85,
    material: 'Cu',
    method: 'PVC_B1',
    sectionMm2: 95,
    parallelCount: 1,
    correctionFactor: 0.82,
    supplyOrigin: 'UTILITY_LV',
  },
  {
    id: 'dc-440-trafo',
    label: 'Subestação 13,8kV / 440V · Alta Potência',
    phase: '3F',
    voltageV: 440,
    installedPowerKw: 480,
    demandFactor: 0.88,
    powerFactor: 0.94,
    lengthMeters: 60,
    material: 'Cu',
    method: 'XLPE_C',
    sectionMm2: 185,
    parallelCount: 2,
    correctionFactor: 0.88,
    supplyOrigin: 'SUBSTATION_OR_GEN',
  },
];

export const QtaLoadSimulator: React.FC<QtaLoadSimulatorProps> = ({
  onAppendTechnicalMemo,
}) => {
  const [phase, setPhase] = useState<SystemPhase>('3F');
  const [voltageV, setVoltageV] = useState<number>(380);
  const [installedPowerKw, setInstalledPowerKw] = useState<number>(220);
  const [demandFactor, setDemandFactor] = useState<number>(0.9);
  const [powerFactor, setPowerFactor] = useState<number>(0.95);
  const [lengthMeters, setLengthMeters] = useState<number>(45);
  const [material, setMaterial] = useState<ConductorMaterial>('Cu');
  const [method, setMethod] = useState<InsulationMethod>('XLPE_C');
  const [sectionMm2, setSectionMm2] = useState<number>(120);
  const [parallelCount, setParallelCount] = useState<number>(2);
  const [correctionFactor, setCorrectionFactor] = useState<number>(0.88);
  const [supplyOrigin, setSupplyOrigin] = useState<SupplyOrigin>('SUBSTATION_OR_GEN');
  const [memoInjected, setMemoInjected] = useState<boolean>(false);

  const applyPreset = (preset: PresetScenario) => {
    setPhase(preset.phase);
    setVoltageV(preset.voltageV);
    setInstalledPowerKw(preset.installedPowerKw);
    setDemandFactor(preset.demandFactor);
    setPowerFactor(preset.powerFactor);
    setLengthMeters(preset.lengthMeters);
    setMaterial(preset.material);
    setMethod(preset.method);
    setSectionMm2(preset.sectionMm2);
    setParallelCount(preset.parallelCount);
    setCorrectionFactor(preset.correctionFactor);
    setSupplyOrigin(preset.supplyOrigin);
    setMemoInjected(false);
  };

  const results = useMemo(() => {
    const safeVoltage = Math.max(110, voltageV);
    const safePowerKw = Math.max(1, installedPowerKw);
    const safeFd = Math.min(1, Math.max(0.2, demandFactor));
    const safePf = Math.min(1, Math.max(0.6, powerFactor));
    const safeLength = Math.max(1, lengthMeters);
    const safeParallel = Math.min(6, Math.max(1, parallelCount));
    const safeFct = Math.min(1.1, Math.max(0.4, correctionFactor));

    // 1. Demanda de Potência (NBR 5410)
    const activeDemandKw = safePowerKw * safeFd;
    const apparentDemandKva = activeDemandKw / safePf;
    const reactiveDemandKvar = Math.sqrt(
      Math.max(0, apparentDemandKva * apparentDemandKva - activeDemandKw * activeDemandKw)
    );

    // 2. Corrente de Projeto IB (A)
    const sqrt3 = Math.sqrt(3);
    const designCurrentA =
      phase === '3F'
        ? (apparentDemandKva * 1000) / (sqrt3 * safeVoltage)
        : (apparentDemandKva * 1000) / safeVoltage;

    // 3. Disjuntor / Chave QTA nominal sugerida (In >= IB)
    const recommendedBreakerA =
      COMMERCIAL_BREAKERS_A.find((rating) => rating >= designCurrentA) ??
      Math.ceil(designCurrentA / 100) * 100;

    // 4. Ampacidade Tabelada Iz (NBR 5410 Tabelas 36 / 37)
    const condRow =
      NBR5410_CONDUCTORS.find((c) => c.sectionMm2 === sectionMm2) ??
      NBR5410_CONDUCTORS[8];

    let baseIzPerCable = 0;
    if (material === 'Cu') {
      baseIzPerCable =
        method === 'PVC_B1'
          ? condRow.cuPvcB1
          : method === 'XLPE_C'
            ? condRow.cuXlpeC
            : condRow.cuXlpeD;
    } else {
      // NBR 5410 §6.2.3.8 proíbe alumínio < 16 mm² em instalações gerais
      baseIzPerCable =
        method === 'XLPE_D' ? condRow.alXlpeD : condRow.alXlpeC;
    }

    // Ajuste simplificado 2 condutores carregados (monofásico/bifásico ≈ +10% sobre 3 condutores)
    const loadedConductorsAdj = phase === '3F' ? 1 : 1.1;
    const effectiveIzTotalA = baseIzPerCable * loadedConductorsAdj * safeFct * safeParallel;

    // 5. Queda de Tensão (NBR 5410 §6.2.7.1)
    // Resistividade em temperatura de operação: Cu 70°C = 0.0210, Cu 90°C = 0.0225, Al 90°C = 0.0360
    const rhoOhmMm2PerM =
      material === 'Cu' ? (method === 'PVC_B1' ? 0.021 : 0.0225) : 0.036;
    // Resistência em Ohm/km por condutor = (rho * 1000) / S
    const resistanceOhmPerKm = (rhoOhmMm2PerM * 1000) / condRow.sectionMm2;
    // Reatância típica de cabos isolados em eletroduto/bandeja (Ohm/km)
    const reactanceOhmPerKm = 0.08;
    const sinPhi = Math.sqrt(Math.max(0, 1 - safePf * safePf));

    const effectiveImpedance =
      resistanceOhmPerKm * safePf + reactanceOhmPerKm * sinPhi;

    const voltageDropV =
      phase === '3F'
        ? (sqrt3 * designCurrentA * safeLength * effectiveImpedance) /
          (safeParallel * 1000)
        : (2 * designCurrentA * safeLength * effectiveImpedance) /
          (safeParallel * 1000);

    const voltageDropPercent = (voltageDropV / safeVoltage) * 100;

    // Limites NBR 5410 §6.2.7.1:
    // Alínea (a) Rede BT concessionária: 4%
    // Alínea (b) Subestação transformadora / Gerador próprio: 7% global (recomendado <= 4% no alimentador QTA)
    const maxDropPercent = supplyOrigin === 'SUBSTATION_OR_GEN' ? 7.0 : 4.0;

    // 6. Verificações de Conformidade NBR 5410
    const aluminumSectionViolation = material === 'Al' && condRow.sectionMm2 < 16;
    const dropCompliant = voltageDropPercent <= maxDropPercent;
    const ampacityCompliant =
      !aluminumSectionViolation &&
      effectiveIzTotalA >= designCurrentA &&
      effectiveIzTotalA >= recommendedBreakerA;
    const powerFactorCompliant = safePf >= 0.92;

    const isOverallCompliant =
      dropCompliant && ampacityCompliant && !aluminumSectionViolation;

    // Recomendação automática de seção mínima para atender queda e ampacidade
    const suggestedCandidate = NBR5410_CONDUCTORS.find((row) => {
      if (material === 'Al' && row.sectionMm2 < 16) return false;
      const iz =
        material === 'Cu'
          ? method === 'PVC_B1'
            ? row.cuPvcB1
            : method === 'XLPE_C'
              ? row.cuXlpeC
              : row.cuXlpeD
          : method === 'XLPE_D'
            ? row.alXlpeD
            : row.alXlpeC;
      const totalIz = iz * loadedConductorsAdj * safeFct * safeParallel;
      const rKm = (rhoOhmMm2PerM * 1000) / row.sectionMm2;
      const imp = rKm * safePf + reactanceOhmPerKm * sinPhi;
      const dv =
        phase === '3F'
          ? (sqrt3 * designCurrentA * safeLength * imp) / (safeParallel * 1000)
          : (2 * designCurrentA * safeLength * imp) / (safeParallel * 1000);
      const dvPct = (dv / safeVoltage) * 100;
      return totalIz >= recommendedBreakerA && dvPct <= maxDropPercent;
    });

    return {
      activeDemandKw,
      apparentDemandKva,
      reactiveDemandKvar,
      designCurrentA,
      recommendedBreakerA,
      effectiveIzTotalA,
      voltageDropV,
      voltageDropPercent,
      maxDropPercent,
      dropCompliant,
      ampacityCompliant,
      powerFactorCompliant,
      aluminumSectionViolation,
      isOverallCompliant,
      suggestedSectionMm2: suggestedCandidate?.sectionMm2 ?? null,
    };
  }, [
    phase,
    voltageV,
    installedPowerKw,
    demandFactor,
    powerFactor,
    lengthMeters,
    material,
    method,
    sectionMm2,
    parallelCount,
    correctionFactor,
    supplyOrigin,
  ]);

  const handleInsertMemo = () => {
    if (!onAppendTechnicalMemo) return;
    const statusText = results.isOverallCompliant
      ? 'CONFORME (ABNT NBR 5410 §6.2.5 e §6.2.7.1)'
      : 'NÃO CONFORME — Requer redimensionamento (ABNT NBR 5410)';
    const memo = [
      `[Memorial de Cálculo QTA/ATS — Base Normativa ABNT NBR 5410]`,
      `- Sistema: ${phase} ${voltageV} V · Origem: ${supplyOrigin === 'SUBSTATION_OR_GEN' ? 'Subestação / Gerador Próprio (ΔV máx 7%)' : 'Rede BT Concessionária (ΔV máx 4%)'}`,
      `- Demanda Calculada: ${results.activeDemandKw.toFixed(1)} kW / ${results.apparentDemandKva.toFixed(1)} kVA (FP ${powerFactor.toFixed(2)}, Fd ${demandFactor.toFixed(2)})`,
      `- Corrente de Projeto (IB): ${results.designCurrentA.toFixed(1)} A · Disjuntor/Chave QTA sugerida (In): ${results.recommendedBreakerA} A`,
      `- Condutor: ${parallelCount}x ${sectionMm2} mm² (${material}, ${method}, Fct ${correctionFactor.toFixed(2)}) · Ampacidade Corrigida (Iz): ${results.effectiveIzTotalA.toFixed(1)} A`,
      `- Queda de Tensão Calculada (ΔV): ${results.voltageDropV.toFixed(2)} V (${results.voltageDropPercent.toFixed(2)}% vs limite ${results.maxDropPercent.toFixed(1)}%)`,
      `- Parecer Técnico: ${statusText}`,
    ].join('\n');
    onAppendTechnicalMemo(memo);
    setMemoInjected(true);
  };

  return (
    <div className="space-y-6">
      {/* Barra de cenários pré-configurados */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Calculator className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <span>Simulador de Carga QTA/ATS · ABNT NBR 5410</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dimensionamento de demanda (kVA), corrente de projeto (IB), ampacidade (Tabelas 36/37) e queda de tensão (§6.2.7.1).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PRESET_SCENARIOS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Painel de Parâmetros de Entrada */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Parâmetros do Circuito QTA / Gerador
            </h2>
            <button
              type="button"
              onClick={() => applyPreset(PRESET_SCENARIOS[0])}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>Padrão</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-1.5 text-xs">
              <span className="block font-medium text-slate-700 dark:text-slate-300">
                Sistema de Fases
              </span>
              <select
                value={phase}
                onChange={(e) => {
                  const next = e.target.value as SystemPhase;
                  setPhase(next);
                  if (next === '1F' && voltageV > 240) setVoltageV(220);
                  if (next === '3F' && voltageV < 200) setVoltageV(380);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="3F">Trifásico (3F+N+PE)</option>
                <option value="2F">Bifásico (2F+PE)</option>
                <option value="1F">Monofásico (F+N+PE)</option>
              </select>
            </label>

            <label className="space-y-1.5 text-xs">
              <span className="block font-medium text-slate-700 dark:text-slate-300">
                Tensão Nominal (V)
              </span>
              <select
                value={voltageV}
                onChange={(e) => setVoltageV(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value={127}>127 V</option>
                <option value={220}>220 V</option>
                <option value={380}>380 V</option>
                <option value={440}>440 V</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-1.5 text-xs">
              <span className="block font-medium text-slate-700 dark:text-slate-300">
                Carga Instalada (kW)
              </span>
              <input
                type="number"
                min={1}
                max={5000}
                step={5}
                value={installedPowerKw}
                onChange={(e) => setInstalledPowerKw(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>

            <label className="space-y-1.5 text-xs">
              <span className="block font-medium text-slate-700 dark:text-slate-300">
                Comprimento (m)
              </span>
              <input
                type="number"
                min={1}
                max={1000}
                step={1}
                value={lengthMeters}
                onChange={(e) => setLengthMeters(Number(e.target.value) || 1)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Fator de Demanda (Fd)
                </span>
                <span className="font-mono tabular-nums text-slate-500">
                  {demandFactor.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0.4}
                max={1}
                step={0.01}
                value={demandFactor}
                onChange={(e) => setDemandFactor(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </label>

            <label className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Fator de Potência (cos φ)
                </span>
                <span className="font-mono tabular-nums text-slate-500">
                  {powerFactor.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0.75}
                max={1}
                step={0.01}
                value={powerFactor}
                onChange={(e) => setPowerFactor(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-1.5 text-xs">
              <span className="block font-medium text-slate-700 dark:text-slate-300">
                Material & Isolação
              </span>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value as ConductorMaterial)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="Cu">Cobre (Cu)</option>
                <option value="Al">Alumínio (Al ≥ 16 mm²)</option>
              </select>
            </label>

            <label className="space-y-1.5 text-xs">
              <span className="block font-medium text-slate-700 dark:text-slate-300">
                Método NBR 5410
              </span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as InsulationMethod)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="PVC_B1">PVC 70°C · B1/B2 (Canaleta/Eletroduto)</option>
                <option value="XLPE_C">XLPE/EPR 90°C · C (Leito/Bandeja)</option>
                <option value="XLPE_D">XLPE/EPR 90°C · D (Subterrâneo)</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="space-y-1.5 text-xs">
              <span className="block font-medium text-slate-700 dark:text-slate-300">
                Seção (mm²)
              </span>
              <select
                value={sectionMm2}
                onChange={(e) => setSectionMm2(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {NBR5410_CONDUCTORS.map((c) => (
                  <option key={c.sectionMm2} value={c.sectionMm2}>
                    {c.sectionMm2} mm²
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-xs">
              <span className="block font-medium text-slate-700 dark:text-slate-300">
                Cabos/Fase
              </span>
              <select
                value={parallelCount}
                onChange={(e) => setParallelCount(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}x por fase
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-xs">
              <span className="block font-medium text-slate-700 dark:text-slate-300">
                Fator Agrup.
              </span>
              <input
                type="number"
                min={0.5}
                max={1}
                step={0.02}
                value={correctionFactor}
                onChange={(e) => setCorrectionFactor(Number(e.target.value) || 0.8)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
          </div>

          <label className="block space-y-1.5 text-xs">
            <span className="block font-medium text-slate-700 dark:text-slate-300">
              Origem da Alimentação (Limite ΔV NBR 5410 §6.2.7.1)
            </span>
            <select
              value={supplyOrigin}
              onChange={(e) => setSupplyOrigin(e.target.value as SupplyOrigin)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="SUBSTATION_OR_GEN">
                Subestação Transformadora 13,8kV / Gerador Próprio (ΔV máx 7,0%)
              </option>
              <option value="UTILITY_LV">
                Rede de Baixa Tensão Concessionária (ΔV máx 4,0%)
              </option>
            </select>
          </label>
        </div>

        {/* Painel de Resultados e Diagnóstico Normativo */}
        <div className="lg:col-span-7 space-y-6">
          {/* KPIs Calculados */}
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="space-y-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Demanda Aparente (S)
              </div>
              <div className="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {results.apparentDemandKva.toFixed(1)} kVA
              </div>
              <div className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {results.activeDemandKw.toFixed(1)} kW · {results.reactiveDemandKvar.toFixed(1)} kVAr
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Corrente de Projeto (IB)
              </div>
              <div className="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {results.designCurrentA.toFixed(1)} A
              </div>
              <div className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                QTA/Disjuntor In: {results.recommendedBreakerA} A
              </div>
            </div>

            <div className="space-y-1 col-span-2 sm:col-span-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Queda de Tensão (ΔV)
              </div>
              <div
                className={`font-mono text-2xl font-semibold tabular-nums ${
                  results.dropCompliant
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-700 dark:text-red-400'
                }`}
              >
                {results.voltageDropPercent.toFixed(2)}%
              </div>
              <div className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {results.voltageDropV.toFixed(2)} V (limite ≤ {results.maxDropPercent.toFixed(1)}%)
              </div>
            </div>
          </div>

          {/* Auditoria Normativa NBR 5410 */}
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:divide-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Verificação de Conformidade · ABNT NBR 5410
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                  results.isOverallCompliant
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-700 dark:text-red-400'
                }`}
              >
                {results.isOverallCompliant ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>Dimensionamento Conforme</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    <span>NC Detectada no Circuito</span>
                  </>
                )}
              </span>
            </div>

            <div className="divide-y divide-slate-100 text-xs dark:divide-slate-800/70">
              <div className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    Critério de Queda de Tensão (§6.2.7.1)
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    ΔV calculado deve ser ≤ {results.maxDropPercent.toFixed(1)}% da tensão nominal
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <span
                    className={
                      results.dropCompliant
                        ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                        : 'font-semibold text-red-700 dark:text-red-400'
                    }
                  >
                    {results.dropCompliant ? 'Conforme' : 'Não Conforme'}
                  </span>
                  <div className="text-slate-500 dark:text-slate-400">
                    {results.voltageDropPercent.toFixed(2)}% / {results.maxDropPercent.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    Capacidade de Condução e Proteção (IB ≤ In ≤ Iz · §5.3.4 / Tab. 36–37)
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    {results.aluminumSectionViolation
                      ? 'Violação §6.2.3.8: Alumínio proibido para seção < 16 mm².'
                      : `Ampacidade corrigida total (${parallelCount}x ${sectionMm2} mm²) frente ao disjuntor ${results.recommendedBreakerA} A`}
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <span
                    className={
                      results.ampacityCompliant
                        ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                        : 'font-semibold text-red-700 dark:text-red-400'
                    }
                  >
                    {results.ampacityCompliant ? 'Conforme' : 'Não Conforme'}
                  </span>
                  <div className="text-slate-500 dark:text-slate-400">
                    Iz = {results.effectiveIzTotalA.toFixed(0)} A
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    Eficiência e Fator de Potência (cos φ ≥ 0,92)
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    Impacto direto no dimensionamento do alternador do grupo gerador e transformador
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <span
                    className={
                      results.powerFactorCompliant
                        ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                        : 'font-semibold text-amber-700 dark:text-amber-400'
                    }
                  >
                    {results.powerFactorCompliant ? 'Nominal' : 'Atenção (< 0,92)'}
                  </span>
                  <div className="text-slate-500 dark:text-slate-400">
                    FP = {powerFactor.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {results.isOverallCompliant ? (
                  <span>
                    Seção atual ({parallelCount}× {sectionMm2} mm²) atende integralmente aos requisitos da NBR 5410.
                  </span>
                ) : results.suggestedSectionMm2 ? (
                  <span>
                    Recomendação NBR 5410: elevar para{' '}
                    <strong className="font-mono text-slate-900 dark:text-slate-100">
                      {parallelCount}× {results.suggestedSectionMm2} mm²
                    </strong>{' '}
                    ou aumentar condutores em paralelo.
                  </span>
                ) : (
                  <span>
                    Recomendação NBR 5410: aumentar o número de condutores em paralelo por fase (2× a 4×).
                  </span>
                )}
              </div>

              {onAppendTechnicalMemo && (
                <button
                  type="button"
                  onClick={handleInsertMemo}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {memoInjected
                      ? 'Memorial Versionado no Doc'
                      : 'Anexar Memorial ao Documento'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
