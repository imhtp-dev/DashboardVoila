"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Phone,
  Calendar,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { getQuestionClusters, getClusterDetails } from "@/lib/frequent-questions-service";
import type { QuestionCluster, ClusterDetail } from "@/types";

export default function DomandeFrequentiPage() {
  // State management
  const [clusters, setClusters] = useState<QuestionCluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<QuestionCluster | null>(null);
  const [clusterDetails, setClusterDetails] = useState<ClusterDetail[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Load clusters on mount
  useEffect(() => {
    loadClusters();
  }, []);

  const loadClusters = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getQuestionClusters();
      setClusters(data);
    } catch (err) {
      console.error("Error loading clusters:", err);
      setError(err instanceof Error ? err.message : "Errore nel caricamento dei dati");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClusterClick = async (cluster: QuestionCluster) => {
    setSelectedCluster(cluster);
    setIsModalOpen(true);
    setIsLoadingDetails(true);

    try {
      const details = await getClusterDetails(cluster.cluster_id);
      setClusterDetails(details);
    } catch (err) {
      console.error("Error loading cluster details:", err);
      setClusterDetails([]);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(clusters.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedClusters = clusters.slice(startIndex, endIndex);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Format date helper
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return dateString;
    }
  };

  // Badge variants helpers
  const getSentimentVariant = (sentiment: string): "default" | "destructive" | "secondary" => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return 'default';
      case 'negative':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getEsitoVariant = (esito: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (esito?.toUpperCase()) {
      case 'COMPLETATA':
        return 'default';
      case 'TRASFERITA':
        return 'secondary';
      case 'NON COMPLETATA':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-gradient-to-br from-blue-50 to-blue-100/80 rounded-xl">
            <HelpCircle className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Domande Frequenti
          </h1>
        </div>
        <p className="text-gray-600 ml-14">
          Analisi delle domande più frequenti raggruppate per cluster
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content Card */}
      <Card className="border border-gray-200/60 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="text-xl font-semibold text-gray-900">
              Cluster di Domande
            </span>
            <Badge variant="secondary" className="text-sm">
              {clusters.length} cluster totali
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            // Loading skeleton
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : clusters.length === 0 ? (
            // Empty state
            <div className="text-center py-12">
              <HelpCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nessun cluster di domande trovato</p>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="rounded-lg border border-gray-100 overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-50/50">
                    <TableRow>
                      <TableHead className="font-semibold">Domanda</TableHead>
                      <TableHead className="font-semibold">Numero Domande</TableHead>
                      <TableHead className="font-semibold">Percentuale</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedClusters.map((cluster) => (
                      <TableRow
                        key={cluster.cluster_id}
                        onClick={() => handleClusterClick(cluster)}
                        className="cursor-pointer hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent transition-all"
                      >
                        <TableCell className="font-medium text-gray-900">
                          {cluster.domanda}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-medium">
                            {cluster.numero_domande}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-blue-100 text-blue-800 font-medium">
                            {cluster.percentuale}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-gray-600">
                    Pagina {currentPage} di {totalPages} ({clusters.length} cluster totali)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousPage}
                      disabled={currentPage === 1}
                      className="border-gray-200 hover:bg-gray-50"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Precedente
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                      className="border-gray-200 hover:bg-gray-50"
                    >
                      Successiva
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto bg-gradient-to-br from-blue-50 via-white to-purple-50 border-blue-200 shadow-2xl backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-900">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              Dettagli Cluster: {selectedCluster?.domanda}
            </DialogTitle>
            {!isLoadingDetails && (
              <p className="text-sm text-gray-600">
                Totale conversazioni: {clusterDetails.length}
              </p>
            )}
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center gap-2 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Caricamento dettagli...</span>
              </div>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : clusterDetails.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nessun dettaglio disponibile per questo cluster</p>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-hidden mt-4">
              <Table>
                <TableHeader className="bg-gray-50/50">
                  <TableRow>
                    <TableHead className="font-semibold">
                      <div className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        Telefono
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Data
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold">Sentiment</TableHead>
                    <TableHead className="font-semibold">Esito Chiamata</TableHead>
                    <TableHead className="font-semibold">Domanda Specifica</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clusterDetails.map((detail, idx) => (
                    <TableRow key={idx} className="hover:bg-blue-50/30 transition-colors">
                      <TableCell className="font-medium">
                        {detail.phone_number}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatDate(detail.started_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getSentimentVariant(detail.sentiment)}>
                          {detail.sentiment}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getEsitoVariant(detail.esito_chiamata)}>
                          {detail.esito_chiamata}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {detail.domanda_specifica}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
