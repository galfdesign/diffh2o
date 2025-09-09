"use client";
import { useMemo, useState } from "react";
import { MATERIALS, compute } from "@/lib/permeation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Info } from "lucide-react";

function fmt(n: number, d = 2) {
  if (!isFinite(n)) return "-";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: d }).format(n);
}

export default function OxygenDiffusionCalculator() {
  const [materialId, setMaterialId] = useState(MATERIALS[0].id);
  const [temperatureC, setTemperatureC] = useState(40);
  const [length_m, setLength_m] = useState(80);
  const [loops, setLoops] = useState(1);
  const [od_mm, setOd_mm] = useState(16);
  const [wall_mm, setWall_mm] = useState(2);
  const [days, setDays] = useState(365);
  const [useManualVolume, setUseManualVolume] = useState(false);
  const [systemVolume_m3, setSystemVolume_m3] = useState(0.0);

  const out = useMemo(() => compute({
    materialId, temperatureC, length_m, loops, od_mm, wall_mm, days,
    useManualVolume, systemVolume_m3: useManualVolume ? systemVolume_m3 : undefined,
  }), [materialId, temperatureC, length_m, loops, od_mm, wall_mm, days, useManualVolume, systemVolume_m3]);

  const Di = Math.max((od_mm - 2*wall_mm)/1000, 0);
  const Ltot = length_m * Math.max(1, loops);
  const Vgeom_m3 = Math.PI * (Di**2)/4 * Ltot;

  const riskColor = out.risk === "High" ? "bg-red-600" : out.risk === "Medium" ? "bg-amber-500" : out.risk === "Low" ? "bg-emerald-600" : "bg-slate-500";

  const rv = out.rv_g_m3_day ?? 0;
  const riskText = out.risk === "High"
    ? "Высокая вероятность интенсивной коррозии"
    : out.risk === "Medium"
    ? "Средняя вероятность коррозии"
    : out.risk === "Low"
    ? "Низкая вероятность коррозии"
    : "Коррозионный риск отсутствует";

  const leakEta = (() => {
    if (rv > 0.2) return "≤1–2 года";
    if (rv > 0.1) return "1–3 года";
    if (rv > 0.05) return "3–7 лет";
    return ">10 лет (маловероятно)";
  })();

  const actions: string[] = (() => {
    if (out.risk === "High") {
      return [
        "Заменить небарьерные участки на барьерные (5‑сл. EVOH) или MLC",
        "Установить/проверить автоматический воздухоотделитель и верхние воздухоотводчики",
        "Исключить подсос воздуха (соединения, насос перед расширительным баком)",
        "Рассмотреть разделение контуров через теплообменник при смешанных материалах",
      ];
    }
    if (out.risk === "Medium") {
      return [
        "Усилить дегазацию (авто‑воздухоотделитель, правильная обвязка бака)",
        "Снизить долю небарьерных контуров или заменить на барьерные",
        "Поддерживать достаточную скорость циркуляции для вымывания микропузырьков",
      ];
    }
    if (out.risk === "Low") {
      return [
        "Поддерживать штатную дегазацию и сервис воздухоотводчиков",
        "Контролировать качество воды и периодически промывать систему",
      ];
    }
    return [];
  })();

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Калькулятор диффузии кислорода в трубы</h1>
      <p className="text-slate-600">Выберите материал трубы, размеры и условия. Приложение оценит приток O₂ через стенку, эквивалент окисляемого железа и риск по DIN 4726.</p>

      <Card>
        <CardHeader>
          <CardTitle>Входные данные</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>Материал / конструкция</Label>
              <Select value={materialId} onValueChange={setMaterialId}>
                <SelectTrigger><SelectValue placeholder="Материал" /></SelectTrigger>
                <SelectContent className="bg-slate-900 text-slate-100">
                  {MATERIALS.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Средняя температура, °C</Label>
                <span className="text-sm text-slate-500">{temperatureC}°C</span>
              </div>
              <Slider value={[temperatureC]} min={20} max={90} step={1} onValueChange={v => setTemperatureC(v[0])} />
            </div>

            <div className="space-y-3">
              <Label>Длина контура, м</Label>
              <Input type="number" value={length_m} onChange={e=>setLength_m(Number(e.target.value)||0)} />
            </div>


            <div className="space-y-3">
              <Label>Наружный диаметр, мм</Label>
              <Input type="number" value={od_mm} onChange={e=>setOd_mm(Number(e.target.value)||0)} />
            </div>

            <div className="space-y-3">
              <Label>Толщина стенки, мм</Label>
              <Input type="number" value={wall_mm} onChange={e=>setWall_mm(Number(e.target.value)||0)} />
            </div>

            <div className="space-y-3">
              <Label>Горизонт расчёта, дней</Label>
              <Input type="number" value={days} onChange={e=>setDays(Math.max(1, Number(e.target.value)||1))} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch checked={useManualVolume} onCheckedChange={setUseManualVolume} id="vol" />
                <Label htmlFor="vol">Задать общий объём воды вручную</Label>
              </div>
              {useManualVolume && (
                <div className="space-y-2">
                  <Label>Объём системы, м³</Label>
                  <Input type="number" value={systemVolume_m3} onChange={e=>setSystemVolume_m3(Number(e.target.value)||0)} />
                </div>
              )}
              {!useManualVolume && (
                <p className="text-xs text-slate-500">По умолчанию объём считается по геометрии: <strong>{fmt(Vgeom_m3,4)}</strong> м³</p>
              )}
            </div>
          </div>

          <Separator />
          <div className="text-sm text-slate-500 flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5"/> <p>Температурная зависимость пермеации аппроксимирована лог‑линейно между 40 и 80 °C. Вне диапазона — экстраполяция.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Результаты</CardTitle>
          <Badge className={`${riskColor}`}>{out.risk}</Badge>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-6">
          <div className="space-y-1">
            <div className="text-xs uppercase text-slate-500">Масса O₂ за год</div>
            <div className="text-2xl font-semibold">{fmt(out.mass_g_per_year, 3)} г/год</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs uppercase text-slate-500">Объём O₂ (Н.У.)</div>
            <div className="text-2xl font-semibold">{fmt(out.volume_L_STP, 2)} л/год</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs uppercase text-slate-500">Объём O₂ в сутки (Н.У.)</div>
            <div className="text-2xl font-semibold">{fmt(out.volume_L_STP_day, 3)} л/сут</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs uppercase text-slate-500">Эквивалент окисляемого Fe</div>
            <div className="text-2xl font-semibold">{fmt(out.iron_oxidized_g, 2)} г/год</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs uppercase text-slate-500">Приведённая скорость</div>
            <div className="text-2xl font-semibold">{out.rv_g_m3_day!==null ? `${fmt(out.rv_g_m3_day,3)} г/(м³·сут)` : "—"}</div>
            <div className="text-xs text-slate-500">Сравнивай с порогом DIN 4726: 0.1 г/(м³·сут) при 40 °C</div>
          </div>
        </CardContent>
      </Card>

      {out.warnings.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Предупреждения</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc pl-6 text-slate-700">
              {out.warnings.map((w,i)=>(<li key={i}>{w}</li>))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Коррозионные риски и циркуляция</CardTitle>
        </CardHeader>
        <CardContent className="text-slate-700 space-y-3 text-sm">
          <div className="font-medium">Текущий прогноз</div>
          <div>
            <span className="font-medium">{riskText}</span>{" "}
            <span>(rv = {fmt(rv,3)} г/(м³·сут)).</span>{" "}
            <span>Ориентир появления свища: {leakEta}.</span>
          </div>

          {actions.length > 0 && (
            <div>
              <div className="font-medium mt-2">Рекомендуемые действия</div>
              <ul className="list-disc pl-6">
                {actions.map((a, i) => (<li key={i}>{a}</li>))}
              </ul>
            </div>
          )}

          <div className="font-medium">Где скапливается кислород (как газ)</div>
          <ul className="list-disc pl-6">
            <li>Верхние точки систем: верх радиаторов, коллекторов, теплообменников, воздухосборники.</li>
            <li>Горизонтальные участки с подъёмом, «карманы» на отводах.</li>
            <li>Зоны с падением давления/ростом температуры (облегчают дегазацию воды).</li>
          </ul>

          <div className="font-medium">Где чаще развивается коррозия</div>
          <ul className="list-disc pl-6">
            <li>Нижняя зона радиаторов и магистралей: дифференциальная аэрация (низ — анод, верх — катод).</li>
            <li>«Мёртвые»/застойные карманы: обратные ответвления на тройниках, нижние коллекторы.</li>
            <li>Под отложениями шлама (подотложечная коррозия).</li>
          </ul>
          <p className="text-xs text-slate-500">Исключение: при длительной воздушной пробке возможна локальная коррозия у верхней кромки панельного радиатора.</p>
        </CardContent>
      </Card>
    </div>
  );
}


