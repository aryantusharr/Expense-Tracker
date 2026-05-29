import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useTheme } from '../../context/ThemeContext';
import './Dashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function ExpenseChart({ monthlyTotals }) {
  const { theme } = useTheme();
  // Only show months with data
  const filtered = monthlyTotals.filter(m => m.total > 0);
  if (filtered.length === 0) return null;

  const maxVal = Math.max(...filtered.map(m => m.total));

  const data = {
    labels: filtered.map(m => m.label),
    datasets: [{
      label: 'Spending',
      data: filtered.map(m => m.total),
      backgroundColor: filtered.map((_, i) => {
        const opacity = 0.4 + (i / Math.max(filtered.length - 1, 1)) * 0.6;
        return `rgba(108, 92, 231, ${opacity})`;
      }),
      borderColor: 'rgba(162, 155, 254, 0.6)',
      borderWidth: 1,
      borderRadius: 8,
      borderSkipped: false,
      barThickness: 'flex',
      maxBarThickness: 50,
    }],
  };

  const textColorSecondary = theme === 'dark' ? 'rgba(245, 245, 247, 0.6)' : 'rgba(28, 28, 30, 0.55)';
  const textColorTertiary = theme === 'dark' ? 'rgba(245, 245, 247, 0.35)' : 'rgba(28, 28, 30, 0.3)';
  const borderLight = theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
  const tooltipBg = theme === 'dark' ? 'rgba(30, 30, 50, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  const tooltipTitle = theme === 'dark' ? '#f5f5f7' : '#1c1c1e';

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipTitle,
        bodyColor: '#a29bfe',
        padding: 14,
        cornerRadius: 10,
        displayColors: false,
        titleFont: { size: 12, weight: 600 },
        bodyFont: { size: 14, weight: 700 },
        callbacks: {
          title: (ctx) => ctx[0].label,
          label: (ctx) => `₹${ctx.raw.toLocaleString('en-IN')}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: textColorSecondary,
          font: { size: 12, weight: 600, family: 'Inter' },
        },
        border: { display: false },
      },
      y: {
        grid: { color: borderLight, drawBorder: false },
        ticks: {
          color: textColorTertiary,
          font: { size: 10, family: 'Inter' },
          // Clean y-axis
          maxTicksLimit: 3,
          callback: (val) => {
            if (val === 0) return '0';
            if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
            if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
            return `₹${val}`;
          },
        },
        border: { display: false },
        beginAtZero: true,
        max: Math.ceil(maxVal * 1.1),
      },
    },
    animation: {
      duration: 800,
      easing: 'easeOutQuart',
    },
  };

  return (
    <div className="card chart-card">
      <div className="chart-container">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}
