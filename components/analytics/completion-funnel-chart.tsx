import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

export function CompletionFunnelChart({ funnel }: { funnel: any }) {
  const data = funnel.stages.map((s: any) => ({
    name: s.name,
    count: Number(s.count),
    percentage: s.percentage
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Completion Funnel</h2>
        <div className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
          {Number(funnel.overallCompletionRate).toFixed(1)}% Conversion
        </div>
      </div>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 40, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" stroke="#9ca3af" width={100} fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'transparent' }}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
              formatter={(value: any, name?: string, props?: any) => [`${value} (${props?.payload?.percentage?.toFixed(1) || 0}%)`, 'Count']}
            />
            <Bar dataKey="count" fill="#4F46E5" radius={[0, 8, 8, 0]} barSize={40}>
              <LabelList dataKey="count" position="right" style={{ fill: '#4b5563', fontSize: '12px' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}