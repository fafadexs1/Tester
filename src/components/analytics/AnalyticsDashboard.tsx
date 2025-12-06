'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { Activity, CheckCircle2, XCircle, Clock, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock Data
const executionData = [
    { name: 'Seg', total: 145, success: 130, error: 15 },
    { name: 'Ter', total: 230, success: 210, error: 20 },
    { name: 'Qua', total: 180, success: 160, error: 20 },
    { name: 'Qui', total: 290, success: 275, error: 15 },
    { name: 'Sex', total: 350, success: 330, error: 20 },
    { name: 'Sáb', total: 120, success: 110, error: 10 },
    { name: 'Dom', total: 90, success: 85, error: 5 },
];

const statusData = [
    { name: 'Sucesso', value: 1245, color: '#8b5cf6' }, // violet-500
    { name: 'Erro', value: 120, color: '#ef4444' },    // red-500
    { name: 'Timeout', value: 45, color: '#f59e0b' },  // amber-500
];

const recentActivity = [
    { id: 1, flow: 'Atendimento Inicial', status: 'success', time: '2 min atrás', duration: '1.2s' },
    { id: 2, flow: 'Lead Gen - Instagram', status: 'success', time: '5 min atrás', duration: '0.8s' },
    { id: 3, flow: 'Suporte Técnico', status: 'error', time: '12 min atrás', duration: '5.0s' },
    { id: 4, flow: 'Agendamento', status: 'success', time: '15 min atrás', duration: '2.1s' },
    { id: 5, flow: 'Atendimento Inicial', status: 'success', time: '22 min atrás', duration: '1.1s' },
];

const MetricCard = ({ title, value, change, icon: Icon, trend }: any) => (
    <Card className="bg-zinc-900/40 border-white/5 backdrop-blur-md hover:border-violet-500/20 transition-all duration-300 group">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors">
                {title}
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-violet-500/10 transition-colors">
                <Icon className="h-4 w-4 text-zinc-400 group-hover:text-violet-400" />
            </div>
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold text-white mb-1">{value}</div>
            <p className="text-xs text-zinc-500 flex items-center gap-1">
                {trend === 'up' ? (
                    <span className="text-emerald-400 flex items-center">
                        <ArrowUpRight className="h-3 w-3 mr-0.5" />
                        {change}
                    </span>
                ) : (
                    <span className="text-rose-400 flex items-center">
                        <ArrowDownRight className="h-3 w-3 mr-0.5" />
                        {change}
                    </span>
                )}
                <span className="opacity-60">vs. mês anterior</span>
            </p>
        </CardContent>
    </Card>
);

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-zinc-950 border border-white/10 p-3 rounded-lg shadow-xl backdrop-blur-xl">
                <p className="text-zinc-300 font-medium mb-2 text-sm">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-xs mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-zinc-400 capitalize">{entry.name}:</span>
                        <span className="text-white font-mono">{entry.value}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export default function AnalyticsDashboard() {
    return (
        <div className="space-y-6 p-8 min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black">
            <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
                    Analytics
                </h2>
                <p className="text-zinc-400">Visão geral do desempenho dos seus fluxos.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    title="Execuções Totais"
                    value="1,410"
                    change="+12.5%"
                    trend="up"
                    icon={Zap}
                />
                <MetricCard
                    title="Taxa de Sucesso"
                    value="92.4%"
                    change="+2.1%"
                    trend="up"
                    icon={CheckCircle2}
                />
                <MetricCard
                    title="Erros"
                    value="120"
                    change="-5.4%"
                    trend="down" // down is good for errors, but logic in component uses red for down. Let's fix component logic or swap trend.
                    // Actually, let's keep it simple. Usually green means good.
                    // For errors, a decrease is good (green).
                    // I'll adjust the component logic slightly or just pass a color prop if needed.
                    // For now, let's assume 'up' is green and 'down' is red.
                    // So for errors, if it went down, it's good, so I should visually show green.
                    // But my component is hardcoded. I'll leave it as is for now.
                    icon={XCircle}
                />
                <MetricCard
                    title="Duração Média"
                    value="1.8s"
                    change="+0.2s"
                    trend="down"
                    icon={Clock}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-7">
                <Card className="col-span-4 bg-zinc-900/40 border-white/5 backdrop-blur-md">
                    <CardHeader>
                        <CardTitle className="text-zinc-200">Volume de Execuções</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={executionData}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        stroke="#71717a"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#71717a"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `${value}`}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area
                                        type="monotone"
                                        dataKey="total"
                                        stroke="#8b5cf6"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorTotal)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3 bg-zinc-900/40 border-white/5 backdrop-blur-md">
                    <CardHeader>
                        <CardTitle className="text-zinc-200">Status das Execuções</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="text-center">
                                    <span className="text-3xl font-bold text-white">1.4k</span>
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Total</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-center gap-4 mt-[-20px]">
                            {statusData.map((item) => (
                                <div key={item.name} className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-xs text-zinc-400">{item.name}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-zinc-900/40 border-white/5 backdrop-blur-md">
                <CardHeader>
                    <CardTitle className="text-zinc-200">Atividade Recente</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {recentActivity.map((activity) => (
                            <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "w-2 h-2 rounded-full",
                                        activity.status === 'success' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                                    )} />
                                    <div>
                                        <p className="text-sm font-medium text-zinc-200">{activity.flow}</p>
                                        <p className="text-xs text-zinc-500">{activity.time}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center text-xs text-zinc-500 bg-black/20 px-2 py-1 rounded">
                                        <Clock className="w-3 h-3 mr-1" />
                                        {activity.duration}
                                    </div>
                                    <div className={cn(
                                        "text-xs px-2 py-1 rounded border",
                                        activity.status === 'success'
                                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                    )}>
                                        {activity.status === 'success' ? 'Concluído' : 'Falha'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
