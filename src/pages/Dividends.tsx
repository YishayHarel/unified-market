import DividendTracker from "@/components/DividendTracker";

const Dividends = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24 space-y-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold">💰 Dividend Tracker</h1>
        <p className="text-muted-foreground mt-2">Track your dividend-paying stocks</p>
      </header>
      
      <DividendTracker />
    </div>
  );
};

export default Dividends;