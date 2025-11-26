"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  X,
  Heart,
  MessageCircle,
  BarChart3,
  TrendingUp,
  CheckCircle,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { dashboardApi, type Region } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";

export default function KPIPage() {
  const [selectedRegion, setSelectedRegion] = useState("All Region");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Data state
  const [regions, setRegions] = useState<Region[]>([]);
  const [sentimentStats, setSentimentStats] = useState<Array<{ sentiment: string; count: number; color: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Chart data state
  const [outcomeTrendData, setOutcomeTrendData] = useState<Array<{ date: string; COMPLETATA: number; TRASFERITA: number; "NON COMPLETATA": number }>>([]);
  const [sentimentTrendData, setSentimentTrendData] = useState<Array<{ date: string; positive: number; neutral: number; negative: number }>>([]);
  const [motivazioneStats, setMotivazioneStats] = useState<Array<{ motivazione: string; count: number; color: string }>>([]);
  const [esitoStats, setEsitoStats] = useState<Array<{ esito: string; count: number; color: string }>>([]);

  // Load initial data
  useEffect(() => {
    loadRegions();
    loadKPIData();
  }, []);

  // Reload when filters change
  useEffect(() => {
    if (regions.length > 0) {
      loadKPIData();
    }
  }, [selectedRegion, startDate, endDate]);

  const loadRegions = async () => {
    try {
      const data = await dashboardApi.getRegions();
      setRegions(data);
    } catch (err) {
      console.error("Error loading regions:", err);
    }
  };

  const loadKPIData = async () => {
    setIsLoading(true);
    setError("");

    try {
      // Load additional stats for sentiment pie chart
      const additionalStats = await dashboardApi.getAdditionalStats({
        region: selectedRegion,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });

      // Map sentiment stats with colors
      const sentimentColors: Record<string, string> = {
        positive: "#10b981",
        neutral: "#3b82f6",
        negative: "#ef4444",
      };
      setSentimentStats((additionalStats.sentiment_stats || []).map((s: { sentiment: string; count: number }) => ({
        ...s,
        color: sentimentColors[s.sentiment?.toLowerCase()] || "#6b7280"
      })));

      // Load outcome trend data for line chart
      const outcomeTrendResponse = await dashboardApi.getCallOutcomeTrend({
        region: selectedRegion,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });

      // Transform outcome trend data for line chart
      const outcomeByDate: Record<string, { COMPLETATA: number; TRASFERITA: number; "NON COMPLETATA": number }> = {};
      outcomeTrendResponse.data.forEach((item: any) => {
        if (!outcomeByDate[item.date]) {
          outcomeByDate[item.date] = { COMPLETATA: 0, TRASFERITA: 0, "NON COMPLETATA": 0 };
        }
        if (item.esito_chiamata) {
          outcomeByDate[item.date][item.esito_chiamata as keyof typeof outcomeByDate[typeof item.date]] = item.count;
        }
      });
      setOutcomeTrendData(Object.keys(outcomeByDate).sort().map(date => ({ date, ...outcomeByDate[date] })));

      // Load sentiment trend data for line chart
      const sentimentTrendResponse = await dashboardApi.getSentimentTrend({
        region: selectedRegion,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });

      // Transform sentiment trend data for line chart
      const sentimentByDate: Record<string, { positive: number; neutral: number; negative: number }> = {};
      sentimentTrendResponse.data.forEach((item: any) => {
        if (!sentimentByDate[item.date]) {
          sentimentByDate[item.date] = { positive: 0, neutral: 0, negative: 0 };
        }
        if (item.sentiment) {
          sentimentByDate[item.date][item.sentiment as keyof typeof sentimentByDate[typeof item.date]] = item.count;
        }
      });
      setSentimentTrendData(Object.keys(sentimentByDate).sort().map(date => ({ date, ...sentimentByDate[date] })));

      // Load call outcome stats for motivazione and esito pie charts
      const outcomeStats = await dashboardApi.getCallOutcomeStats({
        region: selectedRegion,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });

      // Map motivazione stats with colors
      const motivazioneColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
      setMotivazioneStats((outcomeStats.motivation_stats || []).map((m: { motivazione: string; count: number }, idx: number) => ({
        motivazione: m.motivazione,
        count: m.count,
        color: motivazioneColors[idx % motivazioneColors.length]
      })));

      // Map esito stats with specific colors
      const esitoColors: Record<string, string> = {
        "COMPLETATA": "#10b981",
        "TRASFERITA": "#f59e0b",
        "NON COMPLETATA": "#ef4444"
      };
      setEsitoStats((outcomeStats.outcome_stats || []).map((e: { esito_chiamata: string; count: number }) => ({
        esito: e.esito_chiamata,
        count: e.count,
        color: esitoColors[e.esito_chiamata] || "#6b7280"
      })));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Errore nel caricamento dei dati KPI";
      setError(errorMessage);
      console.error("Error loading KPI data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedRegion("All Region");
  };

  const handleFilter = () => {
    loadKPIData();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            KPI Dashboard
          </h1>
          <p className="text-base text-gray-600">
            Analisi avanzata e tendenze delle chiamate
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-2 px-4 py-1.5 border-blue-200 bg-blue-50/50 text-blue-700">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Badge>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Filters */}
      <Card className="border border-gray-200/60 shadow-sm hover:shadow-lg transition-all duration-300 backdrop-blur-sm bg-white/80">
        <CardContent className="pt-6 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            <div className="space-y-2.5">
              <Label className="text-sm font-semibold text-gray-700">Regione</Label>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger className="h-11 border-gray-200 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-200 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((region) => (
                    <SelectItem key={region.value} value={region.value}>
                      {region.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2.5">
              <Label className="text-sm font-semibold text-gray-700">Data Inizio</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-11 border-gray-200 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
              />
            </div>
            <div className="space-y-2.5">
              <Label className="text-sm font-semibold text-gray-700">Data Fine</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-11 border-gray-200 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
              />
            </div>
            <div className="space-y-2.5 sm:col-span-2 lg:col-span-1 xl:col-span-2">
              <Label className="invisible text-sm">Actions</Label>
              <div className="flex gap-3">
                <Button
                  onClick={handleFilter}
                  className="flex-1 h-11 gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 font-medium"
                >
                  <Search className="h-4 w-4 text-white" />
                  <span className="hidden sm:inline">Filtra</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClearFilters}
                  className="flex-1 h-11 gap-2 border-2 hover:bg-gray-50 hover:border-gray-300 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 font-medium"
                >
                  <X className="h-4 w-4" />
                  <span className="hidden sm:inline">Reset</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Charts Row - Trends Over Time */}
      {(outcomeTrendData.length > 0 || sentimentTrendData.length > 0) && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Esito Chiamata Trend */}
          {outcomeTrendData.length > 0 && (
            <Card className="border border-gray-200/60 shadow-sm hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </div>
                  Andamento Esito Chiamate
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={outcomeTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-sm font-medium text-gray-700">{value}</span>}
                    />
                    <Line
                      type="monotone"
                      dataKey="COMPLETATA"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="TRASFERITA"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ fill: '#f59e0b', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="NON COMPLETATA"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ fill: '#ef4444', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Sentiment Trend */}
          {sentimentTrendData.length > 0 && (
            <Card className="border border-gray-200/60 shadow-sm hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </div>
                  Andamento Sentiment
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={sentimentTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-sm font-medium text-gray-700 capitalize">{value}</span>}
                    />
                    <Line
                      type="monotone"
                      dataKey="positive"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="neutral"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="negative"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ fill: '#ef4444', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Pie Charts Row */}
      {sentimentStats.length > 0 || motivazioneStats.length > 0 || esitoStats.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Sentiment Distribution */}
          {sentimentStats.length > 0 && (
            <Card className="border border-gray-200/60 shadow-sm hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-pink-50 to-pink-100">
                    <Heart className="h-5 w-5 text-pink-600" />
                  </div>
                  Distribuzione Sentiment
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={sentimentStats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={false}
                      outerRadius={85}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="sentiment"
                      strokeWidth={2}
                      stroke="#fff"
                    >
                      {sentimentStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => <span className="text-sm font-medium text-gray-700 capitalize">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-center mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm font-semibold text-gray-600">
                    {sentimentStats.reduce((sum, item) => sum + item.count, 0)} chiamate totali
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Motivazione Distribution */}
          {motivazioneStats.length > 0 && (
            <Card className="border border-gray-200/60 shadow-sm hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100">
                    <MessageCircle className="h-5 w-5 text-amber-600" />
                  </div>
                  Distribuzione Motivazioni
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={motivazioneStats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={false}
                      outerRadius={85}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="motivazione"
                      strokeWidth={2}
                      stroke="#fff"
                    >
                      {motivazioneStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => <span className="text-sm font-medium text-gray-700">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Esito Chiamata Distribution */}
          {esitoStats.length > 0 && (
            <Card className="border border-gray-200/60 shadow-sm hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-green-50 to-green-100">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  Distribuzione Esito Chiamate
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={esitoStats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={false}
                      outerRadius={85}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="esito"
                      strokeWidth={2}
                      stroke="#fff"
                    >
                      {esitoStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => <span className="text-sm font-medium text-gray-700">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-center mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm font-semibold text-gray-600">
                    {esitoStats.reduce((sum, item) => sum + item.count, 0)} chiamate totali
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
