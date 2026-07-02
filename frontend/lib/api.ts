const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend";
const REQUEST_TIMEOUT_MS = 30000;
const UPLOAD_REQUEST_TIMEOUT_MS = 30000;
const JOB_POLL_INTERVAL_MS = 1500;
const JOB_POLL_TIMEOUT_MS = 300000;

export type UploadedSample = {
  sample_id: string;
  sample_name: string;
  fasta_header?: string | null;
  sequence_length: number;
  qc_status: string;
  qc_notes: string[];
  predicted_label?: string | null;
  variant_classification?: {
    key: string;
    label: string;
    common_name?: string | null;
    display_label?: string | null;
  } | null;
  mutation_count: number;
};

export type JobResponse = {
  job_id: string;
  status: string;
  sample_count: number;
  samples: UploadedSample[];
};

export type JobSummary = {
  job_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  summary?: Record<string, unknown> | null;
};

export type JobListItem = {
  job_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  sample_count: number;
  reference_accession?: string | null;
  top_classifications: string[];
};

export type SampleDetail = {
  sample_id: string;
  sample_name: string;
  sequence_length: number;
  qc_status: string;
  qc_notes: string[];
  exact_reference_match: boolean;
  sequence_similarity_percent: number;
  mutation_summary: {
    reference_length: number;
    sequence_length: number;
    shared_length: number;
    exact_reference_match: boolean;
    sequence_similarity_percent: number;
    mutation_count: number;
    mutation_types: Record<string, number>;
    transition_count: number;
    transversion_count: number;
    snp_spectrum: Record<string, number>;
  };
  classification?: {
    classifier_name: string;
    predicted_label: string;
    confidence: number;
    rationale: Record<string, unknown>;
    variant_classification: {
      key: string;
      label: string;
      common_name?: string | null;
      display_label?: string | null;
    };
  } | null;
  top_kmers: Array<{ kmer: string; count: number }>;
  mutation_matrix_row: Record<string, number>;
  snp_spectrum: Record<string, number>;
  mutations: Array<{
    position: number;
    reference_base: string;
    alternate_base: string;
    mutation_label: string;
  }>;
};

export type JobReport = {
  job_id: string;
  report_type: string;
  generated_at: string;
  summary: {
    sample_count: number;
    warning_sample_count: number;
    exact_reference_match_count?: number;
    total_detected_mutations: number;
    reference_accession?: string;
    classification_counts?: Record<string, number>;
    top_recurrent_mutations?: Array<{
      mutation_label: string;
      sample_frequency: number;
    }>;
  };
  analytics: JobAnalytics;
  samples: Array<{
    sample_id: string;
    sample_name: string;
    sequence_length: number;
    qc_status: string;
    qc_notes: string[];
    mutation_count: number;
    exact_reference_match: boolean;
    sequence_similarity_percent: number;
    classification?: {
      classifier_name: string;
      predicted_label: string;
      confidence: number;
      variant_classification: {
        key: string;
        label: string;
        common_name?: string | null;
        display_label?: string | null;
      };
    } | null;
    remaining_mutation_count: number;
    top_kmers: Array<{ kmer: string; count: number }>;
    top_mutations: Array<{
      mutation_label: string;
      position: number;
      reference_base: string;
      alternate_base: string;
    }>;
  }>;
};

export type JobAnalytics = {
  job_id: string;
  generated_at: string;
  sample_count: number;
  classification_distribution: Array<{ label: string; value: number }>;
  mutation_frequency: Array<{ label: string; value: number }>;
  snp_frequency: Array<{ label: string; value: number }>;
  kmer_frequency: Array<{ label: string; value: number }>;
  pca_projection: Array<{
    sample_id: string;
    sample_name: string;
    label: string;
    pc1: number;
    pc2: number;
  }>;
  phylogenetic_tree: AnalyticsTreeNode;
  phylogenetic_newick: string;
  consensus_summary: {
    consensus_sequence_preview: string;
    consensus_length: number;
    variable_site_count: number;
    high_variability_sites: Array<{
      position: number;
      consensus_base: string;
      base_counts: Record<string, number>;
    }>;
  };
  cluster_summary: Array<{
    label: string;
    sample_count: number;
    average_similarity_percent: number;
    sample_names: string[];
  }>;
  mutation_heatmap: {
    columns: string[];
    rows: Array<{
      sample_id: string;
      sample_name: string;
      values: number[];
    }>;
  };
  distance_matrix: Array<{
    sample_id: string;
    sample_name: string;
    distances: Array<{
      sample_id: string;
      sample_name: string;
      distance: number;
    }>;
  }>;
};

export type AnalyticsTreeNode = {
    name: string;
    sample_id?: string | null;
    distance?: number | null;
    children: AnalyticsTreeNode[];
  };

export type AnalysisSubmissionStage = "submission" | "processing" | "results";

export class AnalysisSubmissionError extends Error {
  stage: AnalysisSubmissionStage;

  constructor(stage: AnalysisSubmissionStage, message: string) {
    super(message);
    this.name = "AnalysisSubmissionError";
    this.stage = stage;
  }
}

export async function createAnalysisJob(files: File[]): Promise<JobResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  let createdJob: JobResponse;

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/jobs`, {
      method: "POST",
      body: formData
    }, UPLOAD_REQUEST_TIMEOUT_MS);

    if (!response.ok) {
      const errorMessage = await extractErrorMessage(response, "Failed to submit FASTA files for analysis.");
      throw new AnalysisSubmissionError("submission", errorMessage);
    }

    createdJob = (await response.json()) as JobResponse;
  } catch (error) {
    throw ensureSubmissionError(error, "submission");
  }

  let completedJob: JobSummary;

  try {
    completedJob = await waitForJobCompletion(createdJob.job_id);
  } catch (error) {
    throw ensureSubmissionError(error, "processing");
  }

  let samples: UploadedSample[];

  try {
    samples = await getJobSamples(createdJob.job_id);
  } catch (error) {
    throw ensureSubmissionError(error, "results");
  }

  return {
    job_id: createdJob.job_id,
    status: completedJob.status,
    sample_count: samples.length,
    samples
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    const errorMessage = await extractErrorMessage(response, "Unable to load analysis data.");
    throw new Error(errorMessage);
  }

  return response.json();
}

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        return payload.detail;
      }
    } else {
      const text = (await response.text()).trim();
      if (text) {
        return text;
      }
    }
  } catch {
    return fallback;
  }

  return fallback;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The request took too long. Please try again.");
    }

    if (error instanceof TypeError) {
      throw new Error("The app could not reach the analysis server. Please confirm the frontend and backend are both running.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function waitForJobCompletion(jobId: string): Promise<JobSummary> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < JOB_POLL_TIMEOUT_MS) {
    const job = await getJob(jobId);
    if (job.status === "completed") {
      return job;
    }

    if (job.status === "failed") {
      const detail = typeof job.summary?.error === "string" ? job.summary.error : "Analysis job failed.";
      throw new Error(detail);
    }

    await sleep(JOB_POLL_INTERVAL_MS);
  }

  throw new Error("Analysis is still running after 5 minutes. Please refresh the job list in a moment.");
}

function ensureSubmissionError(error: unknown, stage: AnalysisSubmissionStage): AnalysisSubmissionError {
  if (error instanceof AnalysisSubmissionError) {
    return error;
  }

  if (error instanceof Error) {
    return new AnalysisSubmissionError(stage, error.message);
  }

  return new AnalysisSubmissionError(stage, "Unable to complete the analysis request.");
}

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

export function getJob(jobId: string): Promise<JobSummary> {
  return fetchJson<JobSummary>(`/jobs/${jobId}`);
}

export function listJobs(limit = 20, filters?: { q?: string; status?: string }): Promise<JobListItem[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (filters?.q) {
    params.set("q", filters.q);
  }
  if (filters?.status) {
    params.set("status", filters.status);
  }
  return fetchJson<JobListItem[]>(`/jobs?${params.toString()}`);
}

export function getJobSamples(jobId: string): Promise<UploadedSample[]> {
  return fetchJson<UploadedSample[]>(`/jobs/${jobId}/samples`);
}

export function getSample(sampleId: string): Promise<SampleDetail> {
  return fetchJson<SampleDetail>(`/samples/${sampleId}`);
}

export function getJobReport(jobId: string): Promise<JobReport> {
  return fetchJson<JobReport>(`/jobs/${jobId}/report`);
}

export function getJobAnalytics(jobId: string): Promise<JobAnalytics> {
  return fetchJson<JobAnalytics>(`/jobs/${jobId}/analytics`);
}
