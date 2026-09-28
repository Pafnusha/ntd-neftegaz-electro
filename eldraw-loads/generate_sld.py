"""
Генератор однолинейной схемы КТП/НКУ по ведомости нагрузок Пафнуши
через библиотеку eldraw (ГОСТ 2.702 / 2.104 / 2.755 / 2.710, РТМ 36.18.32.4-92).

Вход: JSON, который сохраняет кнопка «Сохранить JSON» модуля loads.html
      (rtm-loads.json, version 3) либо упрощённый пакет {title, un, rows[]}.

Выход: DXF R2010 (nanoCAD / AutoCAD / КОМПАС / QCAD), SVG, PNG, PDF, CSV ПЭ3.
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from eldraw.core.canvas import SchematicCanvas
from eldraw.core.layers import StandardLayers
from eldraw.frames.load_table import LoadFeeder
from eldraw.frames.sheet import Sheet
from eldraw.frames.sizes import SheetFormat
from eldraw.frames.title_block import TitleBlockData
from eldraw.symbols.automation import Terminal
from eldraw.symbols.power import BusBar, CircuitBreaker, ResidualCurrentDevice, SwitchDisconnector

QF_SERIES = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 400, 630, 800, 1000, 1600, 2500]
TR_SERIES = [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300]


def _num(v: Any, default: float = 0.0) -> float:
    try:
        x = float(v)
        return x if math.isfinite(x) else default
    except (TypeError, ValueError):
        return default


def pick_qf(ir_a: float, factor: float = 1.25) -> int:
    need = max(0.0, ir_a) * factor
    for a in QF_SERIES:
        if a >= need - 1e-9:
            return a
    return QF_SERIES[-1]


def pick_tr(s_kva: float) -> int:
    for s in TR_SERIES:
        if s >= s_kva - 1e-9:
            return s
    return int(math.ceil(s_kva))


def cable_for(ir_a: float, phases: int) -> str:
    # грубый подбор ВВГнг-LS по длительному току (воздух, ориентир ПУЭ табл. 1.3.4/1.3.6)
    table = [
        (19, 1.5),
        (27, 2.5),
        (38, 4),
        (50, 6),
        (70, 10),
        (95, 16),
        (120, 25),
        (145, 35),
        (180, 50),
        (220, 70),
        (265, 95),
        (310, 120),
        (350, 150),
        (405, 185),
        (460, 240),
    ]
    sec = table[-1][1]
    for amp, mm2 in table:
        if ir_a <= amp:
            sec = mm2
            break
    cores = 5 if phases == 3 else 3
    return f"ВВГнг-LS {cores}x{sec:g}"


def parse_ph(row: Dict[str, Any]) -> Tuple[int, str]:
    ph = str(row.get("ph") or "")
    if ph.startswith("1"):
        phase = ph[1:] if len(ph) > 1 and ph[1:] in ("L1", "L2", "L3") else "L1"
        return 1, phase
    if row.get("phases") == 1:
        return 1, str(row.get("phase") or "L1")
    return 3, "3~"


@dataclass
class FeederSpec:
    group_num: str
    name: str
    power_kw: float
    current_a: float
    phase: str
    poles: int
    breaker: str
    qf_in: int
    cable: str
    length_m: float
    cat: str
    section: str
    reserve: bool = False


@dataclass
class LoadsProject:
    title: str
    organization: str
    designer: str
    doc_code: str
    un_kv: float
    mode: str
    site: str
    ko: float
    cos_target: float
    kr: float
    pn_kw: float
    pp_kw: float
    qp_kvar: float
    sp_kva: float
    ip_a: float
    str_kva: int
    feeders: List[FeederSpec] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)


def compute_totals(rows: List[Dict[str, Any]], un: float, ko: float, mode: str) -> Dict[str, float]:
    pn = kipn = qsum = n_pn2 = 0.0
    for r in rows:
        n = max(1.0, _num(r.get("n"), 1))
        pu = _num(r.get("pnUnit"))
        ki = _num(r.get("ki"), 0.2)
        c = min(0.999, max(0.1, _num(r.get("cosPhi"), 0.8)))
        ks = _num(r.get("ks"), 0.5)
        p_inst = n * pu
        p_ki = (ks if mode == "demand" else ki) * p_inst
        tg = math.tan(math.acos(c))
        pn += p_inst
        kipn += p_ki
        qsum += p_ki * tg
        n_pn2 += n * pu * pu
    ne = (pn * pn / n_pn2) if n_pn2 > 0 else 1.0
    pp = kipn
    qp = qsum
    sp = math.hypot(pp, qp)
    ip = sp / (math.sqrt(3) * un) if un > 0 else 0.0
    return {
        "pn": pn,
        "kipn": kipn,
        "qp": qp,
        "sp": sp,
        "ip": ip,
        "ne": max(1.0, ne),
        "pp_ko": pp * ko,
        "sp_ko": math.hypot(pp * ko, qp * ko),
        "ip_ko": (math.hypot(pp * ko, qp * ko) / (math.sqrt(3) * un)) if un > 0 else 0.0,
    }


def project_from_json(data: Dict[str, Any]) -> LoadsProject:
    rows = list(data.get("rows") or [])
    un = _num(data.get("un"), 0.4)
    ko = _num(data.get("ko"), 0.9)
    mode = str(data.get("mode") or "rtm")
    tot = compute_totals(rows, un, ko, mode)
    site = str(data.get("site") or "ktp")
    title = str(data.get("title") or (
        "КТП 10(6)/0,4 кВ. Схема электрическая однолинейная"
        if site == "ktp"
        else "Щит НКУ 0,4 кВ. Схема электрическая однолинейная"
    ))

    feeders: List[FeederSpec] = []
    qn = 0
    for r in rows:
        n = max(1, int(_num(r.get("n"), 1)))
        nr = max(0, int(_num(r.get("nr"), 0)))
        pu = _num(r.get("pnUnit"))
        ki = _num(r.get("ki"), 0.2)
        c = min(0.999, max(0.1, _num(r.get("cosPhi"), 0.8)))
        ks = _num(r.get("ks"), 0.5)
        cat = r.get("cat")
        cat_s = "особ." if cat == "special" else str(int(_num(cat, 3)))
        poles, phase = parse_ph(r)
        length = _num(r.get("cableLength_m"), 30)
        p_unit = pu * (ks if mode == "demand" else ki)
        if poles == 1:
            ir_unit = (p_unit / (un * c)) if un * c else 0.0
        else:
            ir_unit = (p_unit / (math.sqrt(3) * un * c)) if un * c else 0.0
        qf = pick_qf(ir_unit)
        cable = str(r.get("cable") or cable_for(ir_unit, poles))
        name = str(r.get("name") or "Приёмник")
        sec = str(r.get("sec") or "A") or "A"

        def add(k: int, reserve: bool, suffix: str) -> None:
            nonlocal qn
            qn += 1
            feeders.append(
                FeederSpec(
                    group_num=str(qn),
                    name=name + suffix,
                    power_kw=round(p_unit, 2),
                    current_a=round(ir_unit, 1),
                    phase=phase,
                    poles=poles,
                    breaker=f"{qf}A {'3P' if poles == 3 else '1P'} C",
                    qf_in=qf,
                    cable=cable,
                    length_m=length,
                    cat=cat_s,
                    section="B" if reserve else (sec if sec in ("A", "B", "U") else "A"),
                    reserve=reserve,
                )
            )

        for i in range(n):
            add(i, False, "" if n == 1 else f" · {i + 1}")
        for i in range(nr):
            add(i, True, f" · рез.{i + 1}")

    notes = [
        "ГОСТ 2.702-2011 — правила выполнения электрических схем (тип Э3 / однолинейная С1).",
        "УГО коммутационных аппаратов — ГОСТ 2.755-87; буквенные коды — ГОСТ 2.710-81.",
        "Рамка и основная надпись — ГОСТ 2.104-2006 / ГОСТ 2.301-68.",
        "Расчёт нагрузок — РТМ 36.18.32.4-92; резерв в ΣPр не входит (ПУЭ 1.2.14).",
        "Чертёж построен библиотекой eldraw (https://github.com/vaganchik/eldraw).",
    ]
    return LoadsProject(
        title=title,
        organization=str(data.get("organization") or "ЭС-Нефтегаз"),
        designer=str(data.get("designer") or ""),
        doc_code=str(data.get("doc_code") or "ЭМ.001.000"),
        un_kv=un,
        mode=mode,
        site=site,
        ko=ko,
        cos_target=_num(data.get("cosTarget"), 0.95),
        kr=_num(data.get("kr"), 1.0),
        pn_kw=round(tot["pn"], 2),
        pp_kw=round(tot["pp_ko"], 2),
        qp_kvar=round(tot["qp"] * ko, 2),
        sp_kva=round(tot["sp_ko"], 2),
        ip_a=round(tot["ip_ko"], 1),
        str_kva=pick_tr(tot["sp_ko"]),
        feeders=feeders,
        notes=notes,
    )


def _choose_sheet(n_feeders: int, two_sections: bool = False):
    # 3P-автомат занимает 30 мм; колонка ≥ 40 мм. Две секции — сразу А1.
    if two_sections or n_feeders > 10:
        return SheetFormat.A1, 40.0
    if n_feeders <= 6:
        return SheetFormat.A3, 45.0
    return SheetFormat.A2, 42.5


def build_sld_from_loads(data: Dict[str, Any]) -> SchematicCanvas:
    proj = project_from_json(data)
    two_sec = any(f.reserve or f.section == "B" for f in proj.feeders)
    fmt, pitch = _choose_sheet(max(1, len(proj.feeders)), two_sections=two_sec)
    title = TitleBlockData(
        doc_code=proj.doc_code,
        title=proj.title,
        organization=proj.organization,
        designer=proj.designer or "—",
        checker="—",
        approver="—",
    )
    sheet = Sheet(dimensions=fmt, title_block_data=title, is_first_sheet=True)
    canvas = SchematicCanvas(step=5.0, sheet=sheet)

    work = [f for f in proj.feeders if not f.reserve and f.section != "U"]
    reserve = [f for f in proj.feeders if f.reserve or f.section == "B"]
    ups = [f for f in proj.feeders if f.section == "U"]
    # резервные, уже попавшие в B, не дублировать в work
    work = [f for f in work if f.section != "B"]

    y_top = fmt.height - 25.0
    canvas.add_text(
        f"{proj.title}  ·  Un={proj.un_kv:g} кВ  ·  Pу={proj.pn_kw:g} кВт  ·  "
        f"Pр={proj.pp_kw:g} кВт  ·  Sр={proj.sp_kva:g} кВ·А  ·  Iр={proj.ip_a:g} А  ·  ТМ {proj.str_kva} кВА",
        (25.0, y_top),
        height=3.5,
        layer=StandardLayers.REFDES.name,
    )
    canvas.add_text(
        "ГОСТ 2.702-2011 / ГОСТ 2.755-87 / ГОСТ 2.104-2006  ·  РТМ 36.18.32.4-92  ·  eldraw ЕСКД",
        (25.0, y_top - 8.0),
        height=2.5,
        layer=StandardLayers.PARAMS.name,
    )

    incomer_in = pick_qf(proj.ip_a, factor=1.1)
    x_in = 45.0
    y_qs = y_top - 45.0
    y_qf = y_qs - 35.0
    y_bus = y_qf - 40.0
    y_feeder = y_bus - 45.0
    y_xt = y_feeder - 40.0

    qs = canvas.add_symbol(
        SwitchDisconnector(
            refdes="QS1",
            value=f"{incomer_in}A",
            model=f"ВН-32 3P {incomer_in}A",
            poles=3,
        ),
        at=(x_in, y_qs),
    )
    canvas.connect((x_in, y_qs + 20.0), qs.pin("in_1"), name="L1")
    canvas.connect((x_in + 15.0, y_qs + 20.0), qs.pin("in_2"), name="L2")
    canvas.connect((x_in + 30.0, y_qs + 20.0), qs.pin("in_3"), name="L3")

    qfin = canvas.add_symbol(
        CircuitBreaker(
            refdes="QF1",
            value=f"{incomer_in}A C",
            model=f"ВА57 3P {incomer_in}A",
            poles=3,
        ),
        at=(x_in, y_qf),
    )
    canvas.connect(qs.pin("out_1"), qfin.pin("in_1"))
    canvas.connect(qs.pin("out_2"), qfin.pin("in_2"))
    canvas.connect(qs.pin("out_3"), qfin.pin("in_3"))

    n_w = max(1, len(work))
    bus_len = max(80.0, (n_w + 1) * pitch)
    bus = canvas.add_symbol(
        BusBar(
            refdes="Шина СЕКЦИЯ 1",
            value="~400/230 В",
            model="Cu 40x5",
            length=bus_len,
            num_taps=n_w + 1,
            tap_pitch=pitch,
        ),
        at=(x_in, y_bus),
    )
    canvas.connect(qfin.pin("out_1"), bus.pin("tap_1"))

    load_rows: List[LoadFeeder] = []
    x0 = x_in + pitch

    def place_group(feeders: List[FeederSpec], bus_sym, tap_offset: int, y_dev: float) -> None:
        for i, fd in enumerate(feeders):
            x = x0 + i * pitch
            ref = f"QF{100 + int(fd.group_num)}"
            poles = 3 if fd.poles == 3 else 1
            if fd.cat == "особ.":
                dev = canvas.add_symbol(
                    ResidualCurrentDevice(
                        refdes=ref.replace("QF", "QFD"),
                        value=f"{fd.qf_in}A 30mA",
                        model=f"АВДТ32 {poles}P {fd.qf_in}A",
                        poles=poles,
                    ),
                    at=(x, y_dev),
                )
            else:
                dev = canvas.add_symbol(
                    CircuitBreaker(
                        refdes=ref,
                        value=f"{fd.qf_in}A C",
                        model=f"ВА47-29 {poles}P {fd.qf_in}A",
                        poles=poles,
                    ),
                    at=(x, y_dev),
                )
            tap_name = f"tap_{tap_offset + i + 1}"
            if tap_name in bus_sym.pins:
                in_pin = dev.pin("in_1") if poles > 1 else dev.pin("in")
                canvas.connect(bus_sym.pin(tap_name), in_pin, add_junction_start=True)
            xt = canvas.add_symbol(
                Terminal(refdes=f"XT{fd.group_num}", value="3~" if poles == 3 else "1", poles=1),
                at=(x, y_xt),
            )
            out_pin = dev.pin("out_1") if poles > 1 else dev.pin("out")
            canvas.connect(out_pin, xt.pin("in"))
            canvas.connect(xt.pin("out"), (x, y_xt - 20.0))
            load_rows.append(
                LoadFeeder(
                    group_num=fd.group_num,
                    name=fd.name[:42],
                    power_kw=fd.power_kw,
                    current_a=fd.current_a,
                    phase=fd.phase,
                    breaker=fd.breaker,
                    cable=fd.cable,
                    length_m=fd.length_m,
                    x_pos=x,
                    width=pitch,
                )
            )

    place_group(work, bus, 1, y_feeder)

    if reserve:
        x_sec = x_in + bus_len + 80.0
        y_qs2 = y_qs
        qs2 = canvas.add_symbol(
            SwitchDisconnector(refdes="QS2", value=f"{incomer_in}A", model=f"ВН-32 3P {incomer_in}A", poles=3),
            at=(x_sec, y_qs2),
        )
        canvas.connect((x_sec, y_qs2 + 20.0), qs2.pin("in_1"), name="L1")
        qf2 = canvas.add_symbol(
            CircuitBreaker(refdes="QF21", value=f"{incomer_in}A C", model=f"ВА57 3P {incomer_in}A", poles=3),
            at=(x_sec, y_qf),
        )
        canvas.connect(qs2.pin("out_1"), qf2.pin("in_1"))
        canvas.connect(qs2.pin("out_2"), qf2.pin("in_2"))
        canvas.connect(qs2.pin("out_3"), qf2.pin("in_3"))
        n_r = max(1, len(reserve))
        bus2_len = max(60.0, (n_r + 1) * pitch)
        bus2 = canvas.add_symbol(
            BusBar(refdes="Шина СЕКЦИЯ 2", value="~400 В рез.", model="Cu 40x5", length=bus2_len, num_taps=n_r + 1, tap_pitch=pitch),
            at=(x_sec, y_bus),
        )
        canvas.connect(qf2.pin("out_1"), bus2.pin("tap_1"))
        # секционный
        canvas.add_text("QF11 секц. АВР", ((x_in + bus_len + x_sec) / 2.0 - 20.0, y_bus + 10.0), height=2.5)
        old_x0 = x0
        x0 = x_sec + pitch
        place_group(reserve, bus2, 1, y_feeder)
        x0 = old_x0

    if ups:
        canvas.add_text("Шина ИБП — особая группа", (25.0, y_xt - 32.0), height=2.5)

    if load_rows:
        canvas.add_load_table(load_rows, header_x=22.0, header_width=48.0, y_bottom=62.0)
    canvas.add_pe3_table()
    return canvas


def generate_files(data: Dict[str, Any], output_base: Path, formats: Optional[List[str]] = None) -> Dict[str, str]:
    formats = formats or ["dxf", "svg", "png", "pdf", "csv"]
    output_base = Path(output_base)
    output_base.parent.mkdir(parents=True, exist_ok=True)
    canvas = build_sld_from_loads(data)
    report = canvas.run_erc(check_unconnected=False)
    out: Dict[str, str] = {"erc": report.summary()}
    if "dxf" in formats:
        out["dxf"] = str(canvas.save_dxf(output_base.with_suffix(".dxf")))
    if "svg" in formats:
        out["svg"] = str(canvas.render_svg(output_base.with_suffix(".svg"), theme="light"))
    if "png" in formats:
        out["png"] = str(canvas.render_png(output_base.with_suffix(".png"), dpi=200))
    if "pdf" in formats:
        out["pdf"] = str(canvas.render_pdf(output_base.with_suffix(".pdf")))
    if "csv" in formats:
        out["csv"] = str(canvas.export_bom_csv(output_base.with_suffix(".csv")))
    return out


def main() -> None:
    p = argparse.ArgumentParser(description="Однолинейка ЕСКД (eldraw) из JSON модуля нагрузок Пафнуши")
    p.add_argument("json_path", nargs="?", default="-", help="rtm-loads.json или '-' для stdin")
    p.add_argument("-o", "--output", default="output/pafnusha-sld-eskd", help="базовый путь без расширения")
    p.add_argument("--formats", default="dxf,svg,png,pdf,csv")
    args = p.parse_args()
    if args.json_path == "-":
        import sys
        data = json.load(sys.stdin)
    else:
        data = json.loads(Path(args.json_path).read_text(encoding="utf-8"))
    result = generate_files(data, Path(args.output), [x.strip() for x in args.formats.split(",") if x.strip()])
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
