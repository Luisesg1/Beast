// Script para descargar GIFs de ExerciseDB v2
// Ejecutar con: node download_gifs.cjs

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.RAPIDAPI_KEY;
if (!API_KEY) {
  console.error("Falta RAPIDAPI_KEY. Define la variable de entorno (ver .env.example).");
  process.exit(1);
}

const NAME_MAP = {
  "Press Banca": "barbell bench press",
  "Press Banca Inclinado": "incline bench press",
  "Press Mancuernas": "dumbbell bench press",
  "Aperturas Mancuernas": "dumbbell fly",
  "Fondos": "chest dip",
  "Crossover Polea": "cable crossover",
  "Press Pecho Máquina": "chest press machine",
  "Dominadas": "pull up",
  "Remo con Barra": "barbell bent over row",
  "Remo Mancuerna": "dumbbell row",
  "Peso Muerto": "barbell deadlift",
  "Pullover": "dumbbell pullover",
  "Jalón al Pecho": "cable lat pulldown",
  "Remo Polea Baja": "cable seated row",
  "Face Pull": "cable face pull",
  "Press Hombro Barra": "barbell overhead press",
  "Press Arnold": "arnold press",
  "Elevaciones Laterales": "dumbbell lateral raise",
  "Elevaciones Frontales": "dumbbell front raise",
  "Pájaros": "dumbbell reverse fly",
  "Press Hombro Máquina": "shoulder press machine",
  "Curl Bíceps Barra": "barbell curl",
  "Curl Mancuernas": "dumbbell bicep curl",
  "Curl Martillo": "hammer curl",
  "Curl Concentrado": "concentration curl",
  "Curl Polea": "cable curl",
  "Press Francés": "skull crusher",
  "Extensión Tríceps Mancuerna": "dumbbell tricep extension",
  "Fondos Tríceps": "tricep dip",
  "Tríceps Polea": "triceps pushdown",
  "Sentadilla": "barbell squat",
  "Sentadilla Goblet": "goblet squat",
  "Zancadas": "lunge",
  "Prensa de Pierna": "leg press",
  "Extensión Cuádriceps": "leg extension",
  "Peso Muerto Rumano": "romanian deadlift",
  "Curl Femoral Tumbado": "lying leg curl",
  "Hip Thrust": "hip thrust",
  "Abductores": "abductor",
  "Pantorrillas Máquina": "calf raise",
  "Elevación de Talones": "standing calf raise",
  "Plancha": "plank",
  "Crunch": "crunch",
  "Elevación de Piernas": "leg raise",
  "Crunch Polea": "cable crunch",
  "Rueda Abdominal": "ab wheel",
  "Burpees": "burpee",
  "Saltar Cuerda": "jump rope",
};

const OUTPUT_DIR = path.join(__dirname, "public", "gifs");
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log("📁 Carpeta public/gifs/ creada");
}

function safeName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function fetchAPI(searchName) {
  return new Promise((resolve, reject) => {
    const url = `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(searchName)}?limit=1&offset=0`;
    const req = https.request(url, {
      method: "GET",
      headers: {
        "x-rapidapi-key": API_KEY,
        "x-rapidapi-host": "exercisedb.p.rapidapi.com",
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("JSON parse error: " + data.slice(0, 200))); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// Descarga un archivo desde una URL con soporte a redirecciones
function downloadFile(url, outputPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) { reject(new Error("Too many redirects")); return; }
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(outputPath);

    const req = protocol.request(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "image/gif,image/*,*/*",
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        file.close();
        try { fs.unlinkSync(outputPath); } catch {}
        const loc = res.headers.location;
        if (!loc) { reject(new Error("Redirect sin location")); return; }
        const nextUrl = loc.startsWith("http") ? loc : new URL(loc, url).href;
        downloadFile(nextUrl, outputPath, redirectCount + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(outputPath); } catch {}
        reject(new Error(`HTTP ${res.statusCode} en ${url}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    });
    req.on("error", (err) => {
      try { fs.unlinkSync(outputPath); } catch {}
      reject(err);
    });
    req.end();
  });
}

// Construye posibles URLs del GIF a partir del ID
function getGifUrls(id) {
  const paddedId = String(id).padStart(4, "0");
  return [
    `https://v2.exercisedb.io/image/${paddedId}`,
    `https://v2.exercisedb.io/image/${id}`,
    `https://exercisedb.p.rapidapi.com/image/${paddedId}`,
  ];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const localMap = {};
const failedExercises = [];

async function tryDownloadGif(id, outputPath) {
  const urls = getGifUrls(id);
  for (const url of urls) {
    try {
      await downloadFile(url, outputPath);
      // Verificar que el archivo no esté vacío
      const size = fs.statSync(outputPath).size;
      if (size > 1000) return true; // OK
      fs.unlinkSync(outputPath);
    } catch (e) {
      try { fs.unlinkSync(outputPath); } catch {}
    }
  }
  return false;
}

async function main() {
  const exercises = Object.keys(NAME_MAP);
  console.log(`\n🚀 Descargando GIFs para ${exercises.length} ejercicios...\n`);

  for (let i = 0; i < exercises.length; i++) {
    const exName = exercises[i];
    const searchName = NAME_MAP[exName];
    const fileName = safeName(exName) + ".gif";
    const outputPath = path.join(OUTPUT_DIR, fileName);

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
      console.log(`⏭️  [${i + 1}/${exercises.length}] Ya existe: ${fileName}`);
      localMap[exName] = `/gifs/${fileName}`;
      continue;
    }

    try {
      process.stdout.write(`⏳ [${i + 1}/${exercises.length}] ${exName}... `);

      const data = await fetchAPI(searchName);

      if (!Array.isArray(data) || data.length === 0) {
        console.log(`❌ No encontrado en API`);
        failedExercises.push({ name: exName, search: searchName, reason: "not found" });
        await sleep(400);
        continue;
      }

      const exercise = data[0];
      const id = exercise.id;

      if (!id) {
        console.log(`❌ Sin ID`);
        failedExercises.push({ name: exName, search: searchName, reason: "no id" });
        await sleep(400);
        continue;
      }

      // Intentar gifUrl primero si existe, luego construir desde ID
      let downloaded = false;

      if (exercise.gifUrl) {
        try {
          await downloadFile(exercise.gifUrl, outputPath);
          const size = fs.statSync(outputPath).size;
          if (size > 1000) {
            downloaded = true;
            console.log(`✅ ${fileName} (${(size/1024).toFixed(0)} KB) [gifUrl]`);
            localMap[exName] = `/gifs/${fileName}`;
          } else {
            try { fs.unlinkSync(outputPath); } catch {}
          }
        } catch {}
      }

      if (!downloaded) {
        downloaded = await tryDownloadGif(id, outputPath);
        if (downloaded) {
          const size = fs.statSync(outputPath).size;
          console.log(`✅ ${fileName} (${(size/1024).toFixed(0)} KB) [id:${id}]`);
          localMap[exName] = `/gifs/${fileName}`;
        } else {
          console.log(`❌ No se pudo descargar (id:${id})`);
          failedExercises.push({ name: exName, search: searchName, reason: `id ${id} failed` });
        }
      }

      await sleep(300);
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      failedExercises.push({ name: exName, search: searchName, reason: err.message });
      await sleep(500);
    }
  }

  const mapOutput = `// AUTO-GENERADO por download_gifs.cjs
const LOCAL_GIF_MAP = ${JSON.stringify(localMap, null, 2)};`;

  fs.writeFileSync(path.join(__dirname, "gif_map.js"), mapOutput);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✅ Descargados: ${Object.keys(localMap).length}/${exercises.length}`);
  if (failedExercises.length > 0) {
    console.log(`❌ Fallidos: ${failedExercises.length}`);
    failedExercises.forEach((f) => console.log(`   - ${f.name} (${f.reason})`));
  }
  console.log("\n📄 Mapa guardado en: gif_map.js");
  console.log("📁 GIFs guardados en: public/gifs/");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch(console.error);
