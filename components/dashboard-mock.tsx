import {
  CalendarDays,
  CreditCard,
  Dog,
  LayoutGrid,
  MessageSquare,
  Receipt,
  Settings,
  ShoppingBag,
  Users,
} from "lucide-react";

const NAV = [
  { icon: LayoutGrid, label: "Dashboard", active: true },
  { icon: CalendarDays, label: "Planning" },
  { icon: Users, label: "Klanten" },
  { icon: Dog, label: "Honden" },
  { icon: Receipt, label: "Facturen" },
  { icon: ShoppingBag, label: "Webshop" },
  { icon: MessageSquare, label: "Berichten" },
];

const AGENDA = [
  { time: "09:00", title: "Puppycursus — groep A", who: "6 honden · Buitenterrein", tone: "brand" },
  { time: "10:30", title: "Gedragsconsult — Bo", who: "Intake · Familie de Vries", tone: "sage" },
  { time: "13:00", title: "Uitlaatronde Noord", who: "5 honden · Route 2", tone: "gold" },
  { time: "15:30", title: "Trimbehandeling — Luna", who: "Knippen & wassen", tone: "ink" },
];

const toneMap: Record<string, string> = {
  brand: "bg-brand",
  sage: "bg-sage",
  gold: "bg-gold",
  ink: "bg-ink-500",
};

export function DashboardMock() {
  return (
    <div className="relative overflow-hidden rounded-[1.6rem] bg-white shadow-lift ring-1 ring-ink/5">
      {/* Topbar */}
      <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-brand/30" />
          <span className="h-3 w-3 rounded-full bg-gold/40" />
          <span className="h-3 w-3 rounded-full bg-sage/30" />
        </div>
        <div className="rounded-full bg-cream-100 px-3 py-1 text-[11px] font-medium text-ink-500">
          app.dogware.nl
        </div>
        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-brand to-gold" />
      </div>

      <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[180px_1fr]">
        {/* Sidebar */}
        <aside className="border-r border-cream-200 bg-cream/40 p-3">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium ${
                  item.active
                    ? "bg-white text-ink shadow-soft ring-1 ring-ink/5"
                    : "text-ink-500"
                }`}
              >
                <item.icon
                  className={`h-4 w-4 shrink-0 ${item.active ? "text-brand" : "text-ink-300"}`}
                />
                <span className="hidden truncate sm:inline">{item.label}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium text-ink-300">
              <Settings className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Instellingen</span>
            </div>
          </nav>
        </aside>

        {/* Main */}
        <main className="p-4 sm:p-5">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
                Donderdag 21 juni
              </p>
              <h3 className="text-lg font-bold text-ink">Goedemorgen, Sanne 👋</h3>
            </div>
            <div className="hidden rounded-full bg-sage-100 px-3 py-1 text-[11px] font-semibold text-sage-600 sm:block">
              Alles op schema
            </div>
          </div>

          {/* Stats */}
          <div className="mb-4 grid grid-cols-3 gap-2.5">
            {[
              { label: "Omzet vandaag", value: "€ 1.240", icon: CreditCard, sub: "+12%" },
              { label: "Boekingen", value: "18", icon: CalendarDays, sub: "4 nieuw" },
              { label: "Open facturen", value: "2", icon: Receipt, sub: "automatisch" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-cream/60 p-3 ring-1 ring-ink/5"
              >
                <s.icon className="mb-2 h-4 w-4 text-brand" />
                <p className="text-[10px] font-medium text-ink-300">{s.label}</p>
                <p className="text-base font-extrabold text-ink">{s.value}</p>
                <p className="text-[10px] font-semibold text-sage-600">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Agenda */}
          <div className="rounded-2xl bg-cream/60 p-3 ring-1 ring-ink/5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold text-ink">Planning van vandaag</p>
              <p className="text-[10px] font-medium text-ink-300">4 afspraken</p>
            </div>
            <div className="flex flex-col gap-1.5">
              {AGENDA.map((row) => (
                <div
                  key={row.time}
                  className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-soft ring-1 ring-ink/5"
                >
                  <span className={`h-8 w-1 rounded-full ${toneMap[row.tone]}`} />
                  <span className="w-10 text-[11px] font-bold text-ink-500">
                    {row.time}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold text-ink">
                      {row.title}
                    </span>
                    <span className="block truncate text-[10px] text-ink-300">
                      {row.who}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
