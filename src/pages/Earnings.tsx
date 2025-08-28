import EarningsCalendar from "@/components/EarningsCalendar";

const Earnings = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24 space-y-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold">📅 Earnings Calendar</h1>
        <p className="text-muted-foreground mt-2">Upcoming earnings reports</p>
      </header>
      
      <EarningsCalendar />
    </div>
  );
};

export default Earnings;