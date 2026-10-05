# eldraw_bridge.py — мост «JSON-спецификация → eldraw (ESKD DXF R2010 / SVG)»
# Для веб-модулей: Нагрузки 1.x / Нагрузки 2.0 / Расчёт ИБП. build(spec: dict)->dict
import base64, os, tempfile

from eldraw.core.canvas import SchematicCanvas
from eldraw.frames.sheet import Sheet
from eldraw.frames.sizes import SheetFormat
from eldraw.frames.title_block import TitleBlockData
from eldraw.frames.load_table import LoadFeeder
from eldraw.symbols.power import BusBar, CircuitBreaker, SwitchDisconnector
from eldraw.symbols.automation import NOContact

FMT = {"A4": "A4_LANDSCAPE", "A3": "A3", "A2": "A2", "A1": "A1"}


def _sheet(spec):
    st = spec.get("stamp", {})
    td = TitleBlockData(
        doc_code=str(st.get("code", "ТИ.ОЛС.01")),
        title=str(st.get("title", "Схема электрическая однолинейная")),
        organization=str(st.get("org", "ЭС-Нефтегаз")),
        designer=str(st.get("by", "гл. специалист")),
        checker=str(st.get("ck", "")),
        approver=str(st.get("ap", "")),
    )
    fmt = getattr(SheetFormat, FMT.get(spec.get("format", "A2"), "A2"))
    return Sheet(dimensions=fmt, title_block_data=td, is_first_sheet=True)


def build(spec: dict) -> dict:
    secz = spec.get("sections", [])
    maxf = max([len(x.get("feeders", [])) for x in secz] or [1])
    totf = sum(len(x.get("feeders", [])) for x in secz)
    if (maxf > 5 or totf > 13) and spec.get("format", "A2") == "A2":
        spec = dict(spec); spec["format"] = "A1"
    sh = _sheet(spec)
    canvas = SchematicCanvas(step=5.0, sheet=sh)
    dims = sh.dimensions
    W, H = float(dims.width), float(dims.height)
    secs = spec["sections"]
    n = max(1, len(secs))
    mL = 30.0
    step5 = lambda v: round(v / 5.0) * 5.0
    secW = step5((W - mL - 25.0) / n)
    topY = step5(H - 55.0); busY = step5(topY - 65.0); feY = step5(busY - 45.0)
    def snap(v): return step5(v)
    canvas.add_text(str(spec.get("title", "Схема электрическая однолинейная")),
                    (170.0, H - 22.0), height=4.0, layer="EL_TEXT")
    canvas.add_text("УГО: ГОСТ 2.755/2.710/2.751; штамп: ГОСТ 2.104; модульная сетка 5 мм; "
                    "ПЭ3 и таблица расчёта нагрузок: ГОСТ 2.702-2011 (РТМ 36.18).",
                    (170.0, H - 28.0), height=2.5, layer="EL_TEXT")
    buses = []
    feeds_all = []
    for si, sc in enumerate(secs):
        bxp = step5(mL + si * secW)
        bw = step5(secW - 32.0)
        feeders = list(sc.get("feeders", []))
        bus = canvas.add_symbol(BusBar(refdes="ШС-%d" % (si + 1),
                                       value="%s · 0,4 кВ" % sc.get("label", "СЕКЦИЯ %d" % (si + 1)),
                                       model="", length=bw, num_taps=max(1, len(feeders) + 1), tap_pitch=40.0),
                                at=(snap(bxp), snap(busY)) )
        buses.append((bus, bxp, bw))
        canvas.add_text("ШС-%d ΣPр=%s" % (si + 1, str(sc.get("sumP", "—"))),
                        (bxp + 2.0, busY + 8.0), height=2.5, layer="EL_TEXT")
        src = sc.get("source") or {}
        if src.get("label"):
            canvas.add_text(str(src["label"]), (snap(bxp + 96.0), snap(topY + 16.0)), height=3.5, layer="EL_TEXT")
        xq = bxp + 32.0
        qs = canvas.add_symbol(SwitchDisconnector(refdes=str(src.get("qs", "QS%d" % (si + 1))),
                                                  value="%sА" % src.get("qsIn", ""), model="ВН-32/ВА",
                                                  poles=3), at=(snap(xq), topY))
        qin = canvas.add_symbol(CircuitBreaker(refdes=str(src.get("qf", "QF0%d" % (si + 1))),
                                               value="%sА (LSI)" % src.get("qfIn", ""), model=str(src.get("qfModel", "ВА")),
                                               poles=3), at=(snap(xq), busY + 30.0))
        canvas.connect((xq, topY + 25.0), qs.pin("in_1"), name="L1")
        canvas.connect((xq + 10.0, topY + 25.0), qs.pin("in_2"), name="L2")
        canvas.connect((xq + 20.0, topY + 25.0), qs.pin("in_3"), name="L3")
        canvas.connect(qs.pin("out_1"), qin.pin("in_1"))
        canvas.connect(qs.pin("out_2"), qin.pin("in_2"))
        canvas.connect(qs.pin("out_3"), qin.pin("in_3"))
        canvas.connect(qin.pin("out_1"), (xq + 10.0, busY + 3.0))
        canvas.add_line((xq + 10.0, busY + 3.0), (xq + 10.0, busY))
        canvas.add_junction((xq + 10.0, busY))
        fx = snap(bxp + 75.0)
        xs = []
        perRow = max(1, int((bw - 62.0) // 40.0))
        rowOf = lambda t: int(t / perRow)
        def colY(fi):
            ry = feY - 92.0 * rowOf(fi)
            return snap(ry)
        for fi, f in enumerate(feeders):
            yy = colY(fi)
            poles = int(f.get("poles", 3) or 3)
            cb = canvas.add_symbol(CircuitBreaker(refdes=str(f["ref"]),
                                                  value="%sА" % f.get("In", ""),
                                                  model="ВА", poles=1 if poles == 1 else 3),
                                   at=(snap(fx), yy), label_pos="right", label_offset=(7.0, 1.0))
            tnum = fi % perRow + 1
            tpname = "tap_%d" % tnum if ("tap_%d" % tnum) in bus.pins else ("tap_1" if "tap_1" in bus.pins else None)
            tp = bus.pin(tpname) if tpname else None
            if tp is not None:
                canvas.connect(tp, cb.pin("in_1"), name=(f.get("phase", "") if poles == 1 else ""))
            canvas.connect(cb.pin("out_1"), (snap(fx), snap(yy - 28.0)))
            canvas.add_text(str(f.get("name", ""))[:13], (snap(fx) + 3.0, yy - 34.0), height=2.2, layer="EL_TEXT")
            canvas.add_text("P%s I%s %s" % (("%g" % round(float(f.get("P", 0) or 0), 1)), round(float(f.get("I", 0) or 0)), str(f.get("phase", "3~"))[:7]),
                            (snap(fx) + 3.0, yy - 38.2), height=2.2, layer="EL_TEXT")
            line2 = "%s %s м" % (f.get("cable", ""), f.get("len", ""))
            if f.get("spz"):
                line2 += " · СПЗ(-FR)"
            canvas.add_text(line2[:20], (snap(fx) + 3.0, yy - 42.4), height=2.2, layer="EL_TEXT")
            xs.append(fx)
            feeds_all.append((f, fx, si))
            if rowOf(fi + 1) != rowOf(fi):
                fx = snap(bxp + 75.0)
            else:
                fx += 40.0
        sc["_xs"] = xs
    for si in range(n - 1):
        (a, ax, abw) = buses[si]
        (b, bx2, bbw) = buses[si + 1]
        p1 = a.pin("main_right") if "main_right" in a.pins else None
        p2 = b.pin("main_left") if "main_left" in b.pins else None
        if p1 is not None and p2 is not None:
            xm = ax + abw + (bx2 - (ax + abw)) / 2.0 - 3.0
            km = canvas.add_symbol(NOContact(refdes="KM%d" % (si + 1), value="ПМ12", model="", poles=1), at=(snap(xm), busY))
            canvas.connect(p1, km.pin("in_1"))
            canvas.connect(km.pin("out_1"), p2)
            canvas.add_text("QF11(Э)/(М)", (snap(xm - 5.0), snap(busY + 15.0)), height=2.2, layer="EL_TEXT")
    canvas.finalize_connections()
    lfs = []
    for ti, (f, x0, si) in enumerate(feeds_all):
        lfs.append(LoadFeeder(group_num=str(f.get("grp", ti + 1)), name=str(f.get("name", ""))[:18],
                              power_kw=float(f.get("Pn", 0) or 0), current_a=float(f.get("I", 0) or 0),
                              phase=str(f.get("phase", "L1-L3"))[:6],
                              breaker="%sА" % f.get("In", ""),
                              cable=str(f.get("cable", ""))[-12:], length_m=float(f.get("len", 0) or 0),
                              x_pos=snap(mL + 60.0 + ti * 25.0), width=25.0))
    maxrows = 1
    for scx in secz:
        pr = max(1, int((secW - 32.0 - 62.0) // 40.0)) or 1
        maxrows = max(maxrows, -(-len(scx.get("feeders", [])) // pr))
    FE2 = 92.0
    bottomFeeder = feY - FE2 * (maxrows - 1) - 47.0
    ytab = max(15.0, min(215.0, bottomFeeder - (5.2 * len(lfs) + 20.0)))
    if lfs:
        try:
            canvas.add_load_table(lfs, header_x=snap(mL), header_width=45.0, y_bottom=snap(ytab))
        except Exception as e:
            print("load table fail:", e)
    try:
        canvas.add_pe3_table()
    except Exception as e:
        print("pe3 fail:", e)
    erc = []
    try:
        rep = canvas.run_erc(check_unconnected=True, check_attributes=True)
        for i in (getattr(rep, "issues", []) or []):
            loc = getattr(i, "location", None)
            locs = ("@(%.0f,%.0f)" % (loc.x, loc.y)) if loc else ""
            erc.append("%s: %s %s" % (getattr(i.severity, "name", i.severity), getattr(i, "message", ""), locs))
        erc = [e for e in erc if "не подключен" not in e][:40]
        erc.append("errors=%d warnings=%d" % (getattr(rep, "error_count", 0), getattr(rep, "warning_count", 0)))
    except Exception as e:
        erc = ["ERC exception: %s" % e]
    tmpd = tempfile.mkdtemp()
    dxfp = os.path.join(tmpd, "s.dxf")
    svgp = os.path.join(tmpd, "s.svg")
    canvas.save_dxf(dxfp)
    canvas.render_svg(svgp)
    with open(dxfp, "rb") as fh:
        dxf_b = fh.read()
    with open(svgp, "r", encoding="utf-8") as fh:
        svg_s = fh.read()
    return {"dxf_b64": base64.b64encode(dxf_b).decode(), "svg": svg_s, "erc": erc,
            "stats": {"sections": n, "feeders": len(feeds_all)}}
