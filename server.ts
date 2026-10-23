import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isVercel = !!process.env.VERCEL;
const DATA_DIR = isVercel ? path.resolve("/tmp", "data") : path.resolve(__dirname, "data");
const DATA_FILE = path.resolve(DATA_DIR, "exams.json");
const CLIENT_CONFIG_FILE = path.resolve(DATA_DIR, "client_config.json");

interface ExamItem {
  id: string;
  authorId?: string;
  authorEmail?: string;
  examTitle: string;
  subject: string;
  googleFormUrl: string;
  durationMinutes: number;
  pinMasuk: string;
  pinKeluar: string;
  pinPengawas: string;
  startTime: string;
  endTime: string;
  timezone: 'WIB' | 'WITA' | 'WIT';
  status: 'draft' | 'active' | 'closed';
  allowedClasses: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ClientAppConfig {
  id: string;
  authorId?: string;
  authorEmail?: string;
  schoolName: string;
  appName: string;
  clientProfile: 'exambro_android' | 'safe_exam_browser' | 'web_kiosk' | 'custom_webview';
  appVersion: string;
  clientSecurityToken: string;
  targetExamId: string;
  lockFullscreen: boolean;
  blockTabSwitch: boolean;
  maxViolations: number;
  blockSplitScreen: boolean;
  blockScreenshot: boolean;
  blockInspectElement: boolean;
  blockCopyPaste: boolean;
  blockBackNav: boolean;
  disableSound: boolean;
  allowedWifiSsid: string;
  userAgentKeyword: string;
  splashNotice: string;
  createdAt: string;
  updatedAt: string;
}

const defaultClientConfig: ClientAppConfig = {
  id: "DEFAULT_CLIENT_CONFIG",
  authorId: "DEFAULT_ADMIN",
  authorEmail: "iswanlabanto18@guru.sma.belajar.id",
  schoolName: "SMA Negeri 1 CBT Exambro",
  appName: "EXAMCBT Lockdown Client",
  clientProfile: "exambro_android",
  appVersion: "v2.5.0",
  clientSecurityToken: "EXAM-SEC-2026-TOKEN",
  targetExamId: "EXAM-2026-001",
  lockFullscreen: true,
  blockTabSwitch: true,
  maxViolations: 3,
  blockSplitScreen: true,
  blockScreenshot: true,
  blockInspectElement: true,
  blockCopyPaste: true,
  blockBackNav: true,
  disableSound: true,
  allowedWifiSsid: "WIFI_LAB_UJIAN",
  userAgentKeyword: "Exambro",
  splashNotice: "Dilarang keras membuka aplikasi lain, membagi layar (split-screen), atau melakukan screenshot selama ujian berlangsung. Pelanggaran tercatat otomatis.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function loadClientConfig(): ClientAppConfig {
  try {
    if (fs.existsSync(CLIENT_CONFIG_FILE)) {
      const raw = fs.readFileSync(CLIENT_CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && parsed.schoolName) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Gagal membaca client_config:", err);
  }
  return defaultClientConfig;
}

function saveClientConfig(cfg: ClientAppConfig) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CLIENT_CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf-8");
  } catch (err) {
    console.error("Gagal menyimpan client_config:", err);
  }
}

let currentClientConfig: ClientAppConfig = loadClientConfig();

// Initial default exams list with 4-digit PINs
const defaultExams: ExamItem[] = [
  {
    id: "EXAM-2026-001",
    examTitle: "Ujian Akhir Semester (UAS) Ganjil",
    subject: "Matematika Peminatan Kelas XII",
    googleFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSe-sample-exam-form/viewform?embedded=true",
    durationMinutes: 90,
    pinMasuk: "4821",
    pinKeluar: "9912",
    pinPengawas: "7788",
    startTime: new Date(Date.now() + 60000 * 15).toISOString().slice(0, 16),
    endTime: new Date(Date.now() + 60000 * 120).toISOString().slice(0, 16),
    timezone: "WIB",
    status: "active",
    allowedClasses: ["XII IPA 1", "XII IPA 2"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "EXAM-2026-002",
    examTitle: "Ujian Tengah Semester (UTS)",
    subject: "Bahasa Indonesia Kelas XI",
    googleFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSe-sample-uts-form/viewform?embedded=true",
    durationMinutes: 60,
    pinMasuk: "5544",
    pinKeluar: "1122",
    pinPengawas: "9900",
    startTime: new Date(Date.now() + 60000 * 120).toISOString().slice(0, 16),
    endTime: new Date(Date.now() + 60000 * 180).toISOString().slice(0, 16),
    timezone: "WIB",
    status: "draft",
    allowedClasses: ["XI IPS 1", "XI IPS 2"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

// Helper to load exams from disk
function loadExams(): ExamItem[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Gagal membaca file data ujian:", err);
  }
  return defaultExams;
}

// Helper to save exams to disk
function saveExams(exams: ExamItem[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(exams, null, 2), "utf-8");
  } catch (err) {
    console.error("Gagal menyimpan file data ujian:", err);
  }
}

// Load initial exams from disk
let examsList: ExamItem[] = loadExams();

const app = express();
app.use(express.json());

// Create API Router
const apiRouter = express.Router();

// API Routes for Exams CRUD
apiRouter.get("/exams", (req, res) => {
  res.json({ success: true, data: examsList });
});

apiRouter.post("/exams", (req, res) => {
  try {
    const newExam: ExamItem = {
      id: req.body.id || `EXAM-${Math.floor(1000 + Math.random() * 9000)}`,
      authorId: req.body.authorId || '',
      authorEmail: req.body.authorEmail || '',
      examTitle: req.body.examTitle || "Ujian Baru",
      subject: req.body.subject || "Mata Pelajaran",
      googleFormUrl: req.body.googleFormUrl || "",
      durationMinutes: Number(req.body.durationMinutes) || 90,
      pinMasuk: req.body.pinMasuk || Math.floor(1000 + Math.random() * 9000).toString(),
      pinKeluar: req.body.pinKeluar || Math.floor(1000 + Math.random() * 9000).toString(),
      pinPengawas: req.body.pinPengawas || Math.floor(1000 + Math.random() * 9000).toString(),
      startTime: req.body.startTime || new Date().toISOString().slice(0, 16),
      endTime: req.body.endTime || new Date(Date.now() + 3600000).toISOString().slice(0, 16),
      timezone: req.body.timezone || "WIB",
      status: req.body.status || "draft",
      allowedClasses: req.body.allowedClasses || ["Semua Kelas"],
      createdAt: req.body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    examsList.unshift(newExam);
    saveExams(examsList);
    res.json({ success: true, message: "Ujian berhasil ditambahkan", data: newExam });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Gagal menambah ujian" });
  }
});

apiRouter.put("/exams/:id", (req, res) => {
  try {
    const { id } = req.params;
    const index = examsList.findIndex(e => e.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: "Ujian tidak ditemukan" });
    }

    examsList[index] = {
      ...examsList[index],
      ...req.body,
      id, // preserve id
      updatedAt: new Date().toISOString(),
    };

    saveExams(examsList);
    res.json({ success: true, message: "Ujian berhasil diperbarui", data: examsList[index] });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Gagal memperbarui ujian" });
  }
});

apiRouter.delete("/exams/:id", (req, res) => {
  try {
    const { id } = req.params;
    const initialLength = examsList.length;
    examsList = examsList.filter(e => e.id !== id);
    if (examsList.length === initialLength) {
      return res.status(404).json({ success: false, message: "Ujian tidak ditemukan" });
    }
    saveExams(examsList);
    res.json({ success: true, message: "Ujian berhasil dihapus" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Gagal menghapus ujian" });
  }
});

// Public Student API: Get exam status and Google Form link
apiRouter.get("/student/exam", (req, res) => {
  const { id } = req.query;
  const exam = id ? examsList.find(e => e.id === id) : examsList.find(e => e.status === 'active') || examsList[0];

  if (!exam) {
    return res.status(404).json({ success: false, message: "Ujian tidak ditemukan" });
  }

  res.json({
    success: true,
    exam: {
      id: exam.id,
      title: exam.examTitle,
      subject: exam.subject,
      durationMinutes: exam.durationMinutes,
      startTime: exam.startTime,
      endTime: exam.endTime,
      timezone: exam.timezone,
      status: exam.status,
      googleFormUrl: exam.googleFormUrl,
      pinMasuk: exam.pinMasuk,
      pinKeluar: exam.pinKeluar,
      pinPengawas: exam.pinPengawas,
    }
  });
});

// Get Client Security and Profile Settings
apiRouter.get("/client/settings", (req, res) => {
  res.json({
    success: true,
    data: currentClientConfig
  });
});

// Update Client Security and Profile Settings
apiRouter.post("/client/settings", (req, res) => {
  try {
    currentClientConfig = {
      ...currentClientConfig,
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    saveClientConfig(currentClientConfig);
    res.json({
      success: true,
      message: "Konfigurasi aplikasi client berhasil diperbarui",
      data: currentClientConfig
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Gagal memperbarui konfigurasi client" });
  }
});

// Dedicated Client Application Endpoint: Returns Google Form URL, 3 PINs, and full security lockdown policies
apiRouter.get("/client/config", (req, res) => {
  const { id, token } = req.query;
  const examId = (id as string) || currentClientConfig.targetExamId;
  const exam = examId ? examsList.find(e => e.id === examId) : examsList.find(e => e.status === 'active') || examsList[0];

  if (!exam) {
    return res.status(404).json({ success: false, message: "Sesi ujian tidak ditemukan" });
  }

  // Token validation if configured
  const isTokenValid = !currentClientConfig.clientSecurityToken ||
    token === currentClientConfig.clientSecurityToken ||
    req.headers['x-client-token'] === currentClientConfig.clientSecurityToken;

  res.json({
    success: true,
    authenticated: isTokenValid,
    client: {
      appName: currentClientConfig.appName,
      schoolName: currentClientConfig.schoolName,
      clientProfile: currentClientConfig.clientProfile,
      appVersion: currentClientConfig.appVersion,
      splashNotice: currentClientConfig.splashNotice,
      security: {
        lockFullscreen: currentClientConfig.lockFullscreen,
        blockTabSwitch: currentClientConfig.blockTabSwitch,
        maxViolations: currentClientConfig.maxViolations,
        blockSplitScreen: currentClientConfig.blockSplitScreen,
        blockScreenshot: currentClientConfig.blockScreenshot,
        blockInspectElement: currentClientConfig.blockInspectElement,
        blockCopyPaste: currentClientConfig.blockCopyPaste,
        blockBackNav: currentClientConfig.blockBackNav,
        disableSound: currentClientConfig.disableSound,
        allowedWifiSsid: currentClientConfig.allowedWifiSsid,
        userAgentKeyword: currentClientConfig.userAgentKeyword,
      }
    },
    exam: {
      id: exam.id,
      examTitle: exam.examTitle,
      subject: exam.subject,
      googleFormUrl: exam.googleFormUrl,
      pinMasuk: exam.pinMasuk,
      pinPengawas: exam.pinPengawas,
      pinKeluar: exam.pinKeluar,
      durationMinutes: exam.durationMinutes,
      startTime: exam.startTime,
      endTime: exam.endTime,
      timezone: exam.timezone,
      status: exam.status,
    }
  });
});

// Safe Exam Browser (.seb) XML Configuration Generator Endpoint
apiRouter.get("/client/seb-config", (req, res) => {
  const { id } = req.query;
  const exam = id ? examsList.find(e => e.id === id) : examsList.find(e => e.status === 'active') || examsList[0];
  const targetUrl = exam ? exam.googleFormUrl : "https://docs.google.com/forms";

  const sebXml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>originatorVersion</key>
  <string>SEB_Win_3.5</string>
  <key>startURL</key>
  <string>${targetUrl}</string>
  <key>sebServerURL</key>
  <string></string>
  <key>allowQuit</key>
  <true/>
  <key>quitURL</key>
  <string></string>
  <key>quitURLConfirm</key>
  <true/>
  <key>hashedAdminPassword</key>
  <string></string>
  <key>allowPreferencesWindow</key>
  <false/>
  <key>allowDeveloperConsole</key>
  <false/>
  <key>browserWindowAllowReload</key>
  <false/>
  <key>browserWindowShowURL</key>
  <integer>0</integer>
  <key>enableAltEsc</key>
  <false/>
  <key>enableAltF4</key>
  <false/>
  <key>enableAltTab</key>
  <false/>
  <key>enableCtrlEsc</key>
  <false/>
  <key>enableEsc</key>
  <false/>
  <key>enableF1</key>
  <false/>
  <key>enableF2</key>
  <false/>
  <key>enableF3</key>
  <false/>
  <key>enableF4</key>
  <false/>
  <key>enableF5</key>
  <false/>
  <key>enableF6</key>
  <false/>
  <key>enableF7</key>
  <false/>
  <key>enableF8</key>
  <false/>
  <key>enableF9</key>
  <false/>
  <key>enableF10</key>
  <false/>
  <key>enableF11</key>
  <false/>
  <key>enableF12</key>
  <false/>
  <key>enablePrintScreen</key>
  <false/>
  <key>enableRightMouse</key>
  <false/>
  <key>enableStartMenu</key>
  <false/>
  <key>enableSwitchToApplications</key>
  <false/>
  <key>showTaskBar</key>
  <false/>
  <key>title</key>
  <string>${currentClientConfig.schoolName} - ${exam ? exam.examTitle : 'Ujian CBT'}</string>
</dict>
</plist>`;

  res.setHeader('Content-Type', 'application/seb; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="exam-config-${exam ? exam.id : 'cbt'}.seb"`);
  res.send(sebXml);
});

// Student PIN verification endpoint
apiRouter.post("/student/verify-pin", (req, res) => {
  const { examId, pin, type } = req.body; // type: 'masuk' | 'keluar' | 'pengawas'

  const exam = examsList.find(e => e.id === examId) || examsList[0];
  if (!exam) {
    return res.status(404).json({ success: false, message: "Ujian tidak ditemukan" });
  }

  if (!pin) {
    return res.status(400).json({ success: false, message: "PIN wajib diisi" });
  }

  let isValid = false;
  let message = "";

  if (type === 'masuk') {
    isValid = pin === exam.pinMasuk;
    message = isValid ? "PIN Masuk benar. Sesi ujian dibuka." : "PIN Masuk salah. Silakan minta ke pengawas.";
  } else if (type === 'keluar') {
    isValid = pin === exam.pinKeluar;
    message = isValid ? "PIN Keluar benar. Anda diizinkan keluar ujian." : "PIN Keluar salah.";
  } else if (type === 'pengawas') {
    isValid = pin === exam.pinPengawas;
    message = isValid ? "Akses pengawas / guru diizinkan." : "PIN Pengawas salah.";
  } else {
    if (pin === exam.pinMasuk) {
      isValid = true;
      message = "PIN Masuk diverifikasi.";
    } else if (pin === exam.pinKeluar) {
      isValid = true;
      message = "PIN Keluar diverifikasi.";
    } else if (pin === exam.pinPengawas) {
      isValid = true;
      message = "PIN Pengawas diverifikasi.";
    } else {
      message = "PIN tidak valid.";
    }
  }

  res.json({
    success: isValid,
    message,
    formUrl: isValid && (type === 'masuk' || type === 'pengawas') ? exam.googleFormUrl : null
  });
});

// AI Assistant endpoint for exam guidelines
apiRouter.post("/ai/generate-guidelines", async (req, res) => {
  try {
    const { subject, examTitle, durationMinutes } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "API Key Gemini belum dikonfigurasi di server."
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const prompt = `Buatkan tata tertib dan petunjuk pengerjaan ujian formal dalam Bahasa Indonesia yang profesional untuk:
- Mata Pelajaran: ${subject}
- Nama Ujian: ${examTitle}
- Durasi: ${durationMinutes} menit

Sertakan poin-poin:
1. Ketentuan Umum & Larangan (kecurangan, membuka tab lain)
2. Petunjuk Pengisian Google Form
3. Tata cara penggunaan PIN Masuk dan PIN Keluar (4 digit angka).
Format dengan rapi menggunakan markdown.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction: "Anda adalah sistem asisten administrasi sekolah profesional yang menyusun tata tertib ujian yang tegas dan jelas.",
      }
    });

    res.json({
      success: true,
      guidelines: response.text || "Gagal menghasilkan panduan."
    });
  } catch (error: any) {
    console.error("Gemini AI error:", error);
    res.status(500).json({ success: false, message: error.message || "Terjadi kesalahan pada AI" });
  }
});

// Mount router on both /api and root level for maximum deployment compatibility
app.use("/api", apiRouter);
app.use(apiRouter);

async function startServer() {
  const PORT = process.env.PORT || 3000;

  // Vite middleware setup for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Only auto-start server when not running in Vercel serverless environment
if (!process.env.VERCEL) {
  startServer();
}

export default app;
