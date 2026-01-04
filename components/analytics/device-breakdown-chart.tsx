import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

export function DeviceBreakdownChart({ devices }: { devices: any[] }) {
  const data = devices.map(d => ({
    name: d.deviceType.charAt(0).toUpperCase() + d.deviceType.slice(1),
    value: Number(d.count),
    percentage: d.percentage
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Devices</h2>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: any, name?: string, props?: any) => [`${value} (${props?.payload?.percentage?.toFixed(1) || 0}%)`, name || '']}
            />
            <Legend verticalAlign="bottom" align="center" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}