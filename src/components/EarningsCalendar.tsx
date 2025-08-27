import { useState, useEffect } from "react";

const EarningsCalendar = () => {
  const [loading, setLoading] = useState(true);
  const [mockEarnings] = useState([
    {
      symbol: "AAPL",
      company: "Apple Inc.",
      date: "Jan 17",
      expected: "2.18",
      previous: "1.88"
    },
    {
      symbol: "GOOGL", 
      company: "Alphabet Inc.",
      date: "Jan 18",
      expected: "1.35",
      previous: "1.05"
    },
    {
      symbol: "TSLA",
      company: "Tesla Inc.", 
      date: "Jan 19",
      expected: "0.86",
      previous: "0.71"
    }
  ]);

  // Mock data for demonstration
  useEffect(() => {
    setTimeout(() => {
      setLoading(false);
    }, 1200);
  }, []);

  if (loading) {
    return (
      <section>
        <h2 className="text-2xl font-semibold mb-4">🗓 Earnings Calendar</h2>
        <p>Loading earnings...</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">🗓 Earnings Calendar</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {mockEarnings.map((earning) => (
          <div key={earning.symbol} className="bg-card p-4 rounded-lg">
            <h3 className="font-semibold mb-2">
              {earning.company} ({earning.symbol})
            </h3>
            <p className="text-sm mb-1">Date: {earning.date}</p>
            <p className="text-sm mb-1">Estimate: ${earning.expected}</p>
            <p className="text-sm">Previous: ${earning.previous}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default EarningsCalendar;