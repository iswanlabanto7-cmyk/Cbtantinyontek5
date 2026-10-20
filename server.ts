import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ExamItem {
  id: string;
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

// Initial default exams list with 4-digit PINs
let examsList: ExamItem[] = [
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
      id: `EXAM-${Math.floor(1000 + Math.random() * 9000)}`,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    examsList.unshift(newExam);
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
