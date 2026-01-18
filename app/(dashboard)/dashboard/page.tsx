"use client";

import { useState, useEffect } from "react";
import { StatCard } from "@/components/dashboard/stat-card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  Euro,
  Phone,
  TrendingUp,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  Heart,
  Target,
  MessageCircle,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingDown,
  LucideIcon,
  Loader2,
  CalendarCheck
} from "lucide-react";
import { dashboardApi, type DashboardStats, type Region, type CallListResponse, type CallItem } from "@/lib/api-client";
import { getBookingCount } from "@/lib/dashboard-service";
import { Skeleton } from "@/components/ui/skeleton";
import { ColumnFilter } from "@/components/dashboard/column-filter";

// Filter options for columns
const SENTIMENT_OPTIONS = [
  { value: "positive", label: "Positive", color: "bg-green-500" },
  { value: "negative", label: "Negative", color: "bg-red-500" },
  { value: "neutral", label: "Neutral", color: "bg-blue-500" },
];

const ESITO_OPTIONS = [
  { value: "COMPLETATA", label: "Completata", color: "bg-green-500" },
  { value: "TRASFERITA", label: "Trasferita", color: "bg-yellow-500" },
  { value: "NON COMPLETATA", label: "Non Completata", color: "bg-red-500" },
];

const MOTIVAZIONE_OPTIONS = [
  { value: "Richiesta paziente", label: "Richiesta paziente" },
  { value: "Info fornite", label: "Info fornite" },
  { value: "Argomento sconosciuto", label: "Argomento sconosciuto" },
  { value: "Interrotta dal paziente", label: "Interrotta dal paziente" },
  { value: "Mancata comprensione", label: "Mancata comprensione" },
  { value: "Problema Tecnico", label: "Problema Tecnico" },
  { value: "Fuori orario", label: "Fuori orario" },
  { value: "Prenotazione", label: "Prenotazione" },
  { value: "N/A", label: "N/A" },
];

export default function DashboardPage() {
  const [selectedRegion, setSelectedRegion] = useState("All Region");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedCall, setSelectedCall] = useState<CallItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageInputValue, setPageInputValue] = useState("1");

  // Column filter states
  const [sentimentFilter, setSentimentFilter] = useState<string[]>([]);
  const [esitoFilter, setEsitoFilter] = useState<string[]>([]);
  const [motivazioneFilter, setMotivazioneFilter] = useState<string[]>([]);

  // Real data state
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [calls, setCalls] = useState<CallListResponse | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [bookingCount, setBookingCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Load initial data
  useEffect(() => {
    loadRegions();
    loadDashboardData();
  }, []);

  // Reload when filters/page changes
  useEffect(() => {
    if (regions.length > 0) {
      loadDashboardData();
    }
  }, [selectedRegion, startDate, endDate, currentPage, searchQuery, sentimentFilter, esitoFilter, motivazioneFilter]);

  // Sync page input value when currentPage changes (from prev/next buttons)
  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  const loadRegions = async () => {
    try {
      const data = await dashboardApi.getRegions();
      // Ensure Piemonte is always available in regions
      const hasPiemonte = data.some(r => r.value === "Piemonte");
      if (!hasPiemonte) {
        data.push({ value: "Piemonte", label: "Piemonte" });
      }
      setRegions(data);
    } catch (err) {
      console.error("Error loading regions:", err);
    }
  };

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      // Load stats
      const statsData = await dashboardApi.getStats({
        region: selectedRegion,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setStats(statsData);

      // Load calls
      const callsData = await dashboardApi.getCalls({
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        region: selectedRegion,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        search_query: searchQuery || undefined,
        sentiment: sentimentFilter.length > 0 ? sentimentFilter : undefined,
        esito: esitoFilter.length > 0 ? esitoFilter : undefined,
        motivazione: motivazioneFilter.length > 0 ? motivazioneFilter : undefined,
      });
      setCalls(callsData);

      // Load booking count
      const bookings = await getBookingCount({
        region: selectedRegion,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setBookingCount(bookings);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Errore nel caricamento dei dati";
      setError(errorMessage);
      console.error("Error loading dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedRegion("All Region");
    setSearchQuery("");
    setSentimentFilter([]);
    setEsitoFilter([]);
    setMotivazioneFilter([]);
    setCurrentPage(1);
  };

  const handleFilter = () => {
    setCurrentPage(1);
    loadDashboardData();
  };

  const handleViewCall = async (call: CallItem) => {
    try {
      // Fetch full call details including summary and transcript from backend
      const callDetails = await dashboardApi.getCallSummary(call.call_id || "");
      setSelectedCall({ ...call, ...callDetails });
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error fetching call details:", error);
      // Fallback to basic data if API call fails
      setSelectedCall(call);
      setIsModalOpen(true);
    }
  };

  const totalPages = calls?.pagination.total_pages || 1;
  const paginatedCalls = calls?.calls || [];
  const totalCalls = calls?.pagination.total_calls || 0;

  const getSentimentBadge = (sentiment: string) => {
    const variants: Record<string, { className: string; icon: LucideIcon }> = {
      positive: { className: "bg-green-100 text-green-800 hover:bg-green-200", icon: Heart },
      negative: { className: "bg-red-100 text-red-800 hover:bg-red-200", icon: TrendingDown },
      neutral: { className: "bg-blue-100 text-blue-800 hover:bg-blue-200", icon: Activity },
    };
    const config = variants[sentiment?.toLowerCase()] || { className: "", icon: Activity };
    const Icon = config.icon;
    return (
      <Badge className={`${config.className} gap-1`}>
        <Icon className="h-3 w-3" />
        {sentiment}
      </Badge>
    );
  };

  const getEsitoBadge = (esito: string) => {
    const variants: Record<string, { className: string; icon: LucideIcon }> = {
      COMPLETATA: { className: "bg-green-100 text-green-800 hover:bg-green-200", icon: CheckCircle },
      TRASFERITA: { className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200", icon: TrendingUp },
      "NON COMPLETATA": { className: "bg-red-100 text-red-800 hover:bg-red-200", icon: XCircle },
    };
    const config = variants[esito] || { className: "", icon: AlertCircle };
    const Icon = config.icon;
    return (
      <Badge className={`${config.className} gap-1`}>
        <Icon className="h-3 w-3" />
        {esito}
      </Badge>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-base text-gray-600">
            Panoramica completa delle chiamate e statistiche
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-green-500 rounded-full blur-md opacity-20 animate-pulse"></div>
            <Badge variant="outline" className="relative gap-2 px-4 py-1.5 border-green-200 bg-green-50/50 text-green-700 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Live
            </Badge>
          </div>
        </div>
      </div>

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

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {isLoading && !stats ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="border border-gray-200/60">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-3 flex-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-8 w-32" />
                    </div>
                    <Skeleton className="h-16 w-16 rounded-2xl" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <StatCard
              title="Totale Minuti"
              value={`${(stats?.total_minutes || 0).toLocaleString()} min`}
              icon={Clock}
              iconColor="text-blue-600"
            />
            <StatCard
              title="Corrispettivo Euro"
              value={`€ ${(stats?.total_revenue || 0).toFixed(2)}`}
              icon={Euro}
              iconColor="text-green-600"
            />
            <StatCard
              title="Nr. Chiamate"
              value={(stats?.total_calls || 0).toLocaleString()}
              icon={Phone}
              iconColor="text-purple-600"
            />
            <StatCard
              title="Durata Media"
              value={`${(stats?.avg_duration_minutes || 0).toFixed(1)} min`}
              icon={TrendingUp}
              iconColor="text-yellow-600"
            />
            <StatCard
              title="Prenotazione"
              value={bookingCount.toLocaleString()}
              icon={CalendarCheck}
              iconColor="text-teal-600"
            />
          </>
        )}
      </div>


      {/* Recent Calls Table */}
      <Card className="border-gray-100 shadow-sm hover:shadow-md transition-all">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-600" />
              Chiamate Recenti
            </CardTitle>
            <div className="flex items-center gap-3">
              {/* Search by Phone or Call ID */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Cerca telefono o ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 pr-8 h-9 w-52 border-gray-200 focus:border-blue-400 focus:ring-blue-100"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setCurrentPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Badge variant="secondary" className="gap-1">
                <Activity className="h-3 w-3" />
                {totalCalls} chiamate
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-gray-100 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                  <TableHead className="font-semibold">ID</TableHead>
                  <TableHead className="font-semibold">Data/Ora</TableHead>
                  <TableHead className="font-semibold">Telefono</TableHead>
                  <TableHead className="font-semibold">Durata</TableHead>
                  <TableHead className="font-semibold p-0">
                    <ColumnFilter
                      title="Sentiment"
                      options={SENTIMENT_OPTIONS}
                      selectedValues={sentimentFilter}
                      onFilterChange={(values) => {
                        setSentimentFilter(values);
                        setCurrentPage(1);
                      }}
                    />
                  </TableHead>
                  <TableHead className="font-semibold p-0">
                    <ColumnFilter
                      title="Esito"
                      options={ESITO_OPTIONS}
                      selectedValues={esitoFilter}
                      onFilterChange={(values) => {
                        setEsitoFilter(values);
                        setCurrentPage(1);
                      }}
                    />
                  </TableHead>
                  <TableHead className="font-semibold p-0">
                    <ColumnFilter
                      title="Motivazione"
                      options={MOTIVAZIONE_OPTIONS}
                      selectedValues={motivazioneFilter}
                      onFilterChange={(values) => {
                        setMotivazioneFilter(values);
                        setCurrentPage(1);
                      }}
                    />
                  </TableHead>
                  <TableHead className="font-semibold">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <>
                    {[...Array(5)].map((_, i) => (
                      <TableRow key={i} className="border-b">
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      </TableRow>
                    ))}
                  </>
                ) : paginatedCalls.length > 0 ? (
                      paginatedCalls.map((call, index) => (
                        <TableRow 
                          key={call.id} 
                          className="group hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent border-b transition-all duration-200"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <TableCell className="font-semibold text-gray-900">{call.id}</TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {call.started_at ? new Date(call.started_at).toLocaleString("it-IT") : "N/A"}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-gray-700">
                            {call.phone_number || "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1 font-medium">
                              <Clock className="h-3 w-3" />
                              {call.duration_seconds}s
                            </Badge>
                          </TableCell>
                          <TableCell>{getSentimentBadge(call.sentiment)}</TableCell>
                          <TableCell>{getEsitoBadge(call.esito_chiamata || "N/A")}</TableCell>
                          <TableCell className="text-sm text-gray-600">{call.motivazione || "N/A"}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewCall(call)}
                              className="hover:bg-blue-50 hover:text-blue-700 transition-all"
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Dettagli
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nessuna chiamata trovata per i filtri selezionati
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!isLoading && totalCalls > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t gap-4">
                  <div className="text-sm font-medium text-gray-600">
                    Mostrando <span className="text-gray-900 font-semibold">{(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCalls)}</span> di{" "}
                    <span className="text-gray-900 font-semibold">{totalCalls}</span> chiamate
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-9 gap-2 border-2 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Precedente</span>
                    </Button>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-lg border border-blue-200">
                      <Input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={pageInputValue}
                        onChange={(e) => {
                          // Only update the input value, don't navigate yet
                          setPageInputValue(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const page = parseInt(pageInputValue);
                            if (page >= 1 && page <= totalPages) {
                              setCurrentPage(page);
                            } else {
                              // Reset to current page if invalid
                              setPageInputValue(currentPage.toString());
                            }
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        onBlur={() => {
                          const page = parseInt(pageInputValue);
                          if (page >= 1 && page <= totalPages) {
                            setCurrentPage(page);
                          } else {
                            // Reset to current page if invalid
                            setPageInputValue(currentPage.toString());
                          }
                        }}
                        className="w-14 h-7 text-center text-sm font-semibold text-blue-900 border-blue-200 focus:border-blue-400 focus:ring-blue-100 p-1"
                      />
                      <span className="text-sm text-blue-600">/</span>
                      <span className="text-sm font-medium text-blue-700">
                        {totalPages}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-9 gap-2 border-2 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                    >
                      <span className="hidden sm:inline">Successiva</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
          )}
        </CardContent>
      </Card>

      {/* Call Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-gradient-to-br from-blue-50 via-white to-purple-50 border-blue-200 shadow-2xl backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-900">
              <FileText className="h-5 w-5 text-blue-600" />
              Dettagli Chiamata
              {selectedCall?.id && (
                <Badge variant="outline" className="ml-2 font-mono text-xs">
                  ID: {selectedCall.id}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedCall && (
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-blue-100/50">
                <TabsTrigger value="summary" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-700">
                  <FileText className="h-4 w-4" />
                  Summary
                </TabsTrigger>
                <TabsTrigger value="intent" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-700">
                  <Target className="h-4 w-4" />
                  Patient Intent
                </TabsTrigger>
                <TabsTrigger value="transcript" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-700">
                  <MessageCircle className="h-4 w-4" />
                  Transcript
                </TabsTrigger>
              </TabsList>
              <TabsContent value="summary" className="space-y-4 mt-4">
                <div className="bg-white/80 backdrop-blur-sm p-4 rounded-lg border border-blue-100 shadow-sm">
                  <pre className="text-sm whitespace-pre-wrap text-gray-800">
                    {(selectedCall as any).summary || "Nessun summary disponibile"}
                  </pre>
                </div>
              </TabsContent>
              <TabsContent value="intent" className="space-y-4 mt-4">
                <div className="space-y-3 bg-white/80 backdrop-blur-sm p-4 rounded-lg border border-blue-100 shadow-sm">
                  <div className="flex items-center gap-2">
                    <strong className="text-sm text-blue-900">Esito:</strong>
                    {getEsitoBadge(selectedCall.esito_chiamata || "N/A")}
                  </div>
                  <div className="flex items-center gap-2">
                    <strong className="text-sm text-blue-900">Motivazione:</strong>
                    <span className="text-sm text-gray-800">{selectedCall.motivazione || "N/A"}</span>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="transcript" className="space-y-4 mt-4">
                <div className="bg-white/80 backdrop-blur-sm p-4 rounded-lg border border-blue-100 shadow-sm">
                  <pre className="text-sm whitespace-pre-wrap font-mono text-gray-800">
                    {(selectedCall as any).transcript || "Nessun transcript disponibile"}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
