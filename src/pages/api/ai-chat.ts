// src/pages/api/ai-chat.ts
import OpenAI from 'openai';
import { createClient } from "@supabase/supabase-js";
import type { APIRoute } from "astro";

// Configuración de OpenAI
const OPENAI_API_KEY = (import.meta as any).env?.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error("Missing OpenAI API Key");
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

// Configuración de Supabase
const SUPABASE_URL = (import.meta as any).env?.SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = (import.meta as any).env?.SUPABASE_SERVICE_ROLE_KEY ?? 
  (import.meta as any).env?.SUPABASE_SERVICE_ROLE ?? 
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 
  process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// Funciones para consultar diferentes aspectos de la producción
async function getAvailableSizes() {
  const { data, error } = await supabase
    .from('sizes')
    .select('size')
    .order('size', { ascending: true });

  if (error) throw error;
  return (data || []).map(item => item.size);
}

async function getProductionStats() {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const tomorrowStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
  
  // Paquetes de hoy
  const { count: packetsToday } = await supabase
    .from('packets')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart)
    .lt('created_at', tomorrowStart);

  // Pallets activos
  const { count: activePallets } = await supabase
    .from('pallets')
    .select('*', { count: 'exact', head: true })
    .is('closed_at', null);

  // Raw pallets
  const { count: rawPallets } = await supabase
    .from('raw_pallets')
    .select('*', { count: 'exact', head: true });

  return {
    packetsToday: packetsToday || 0,
    activePallets: activePallets || 0,
    rawPallets: rawPallets || 0,
  };
}

async function getRecentPackets(limit = 10) {
  const { data, error } = await supabase
    .from('packets')
    .select('iso_number, size, thermoformer_number, pallet_id, packet_index, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function getPalletInfo() {
  const { data, error } = await supabase
    .from('pallets')
    .select('id, pallet_number, size, thermoformer_number, opened_at, closed_at')
    .order('opened_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
}

async function getRawPalletsInfo() {
  const { data, error } = await supabase
    .from('raw_pallets')
    .select('supplier, pallet_no, stock_code, batch_number, sticker_date, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data || [];
}

async function getProductionBySize() {
  const { data, error } = await supabase
    .from('packets')
    .select('size')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error) throw error;
  
  const counts = (data || []).reduce((acc: Record<number, number>, packet) => {
    acc[packet.size] = (acc[packet.size] || 0) + 1;
    return acc;
  }, {});

  return counts;
}

async function searchRelevantData(question: string) {
  const stats = await getProductionStats();
  const recentPackets = await getRecentPackets();
  const palletInfo = await getPalletInfo();
  const rawPallets = await getRawPalletsInfo();
  const productionBySize = await getProductionBySize();
  const availableSizes = await getAvailableSizes();

  return {
    stats,
    recentPackets,
    palletInfo,
    rawPallets,
    productionBySize,
    availableSizes,
    currentTime: new Date().toISOString(),
    timezone: 'Pacific/Auckland (New Zealand)'
  };
}

// Sistema de prompts multiidioma
const SYSTEM_PROMPTS = {
  en: `
You are an intelligent assistant for Plixies production system, a thermoforming company in New Zealand.

PROCESS INFORMATION:
- We manufacture plastic products using thermoforming
- We have 2 thermoformers (TH1 and TH2)
- We produce ONLY these sizes: 22, 25, 27, 30 (NOT 15 or 20)
- Each pallet can contain up to 24 packets
- We use 3 shifts: DS (Day Shift 6:00-14:30), TW (Twilight 14:30-23:00), NS (Night Shift 23:00-6:00)
- Timezone: Pacific/Auckland (New Zealand)

REAL DATABASE STRUCTURE:
1. packets: Each production record with iso_number (unique per size), size (22,25,27,30), thermoformer_number (1,2), shift (DS/TW/NS), raw_materials, batch_number, box_number, pallet_id, packet_index (1-24), created_at
2. pallets: Containers for packets with pallet_number (global counter), size (22,25,27,30), thermoformer_number (1,2), opened_at, closed_at
3. raw_pallets: Raw material inventory with supplier, pallet_no, stock_code, batch_number, sticker_date, rolls_total (always 4), rolls_used
4. rolls: Scanned rolls in intake with thermoformer_number, raw_materials, batch_number, box_number, photo_path
5. sizes: Available sizes configuration (22, 25, 27, 30)
6. shifts: DS/TW/NS with specific times
7. iso_counters: Last ISO number generated per size
8. pallet_counter: Global pallet counter

IMPORTANT RULES:
- NEVER mention sizes 15 or 20 - they don't exist in our system
- Always use REAL sizes: 22, 25, 27, 30
- ISO numbers are unique per size (not global)
- Pallet numbers are global across all sizes and thermoformers
- Each raw pallet starts with 4 rolls, rolls_used decreases as consumed

INSTRUCTIONS:
- Respond naturally and conversationally in English
- Use ONLY real data and real sizes (22, 25, 27, 30)
- If data is insufficient, state it clearly
- Include specific numbers when possible
- Mention dates and times when relevant
- Explain process concepts accurately based on real DB structure

Respond helpfully and specifically based on REAL data and REAL sizes.
`,
  
  es: `
Eres un asistente inteligente para el sistema de producción de Plixies, una empresa de thermoforming en Nueva Zelanda.

INFORMACIÓN DEL PROCESO:
- Fabricamos productos plásticos usando thermoforming
- Tenemos 2 thermoformers (TH1 y TH2)
- Producimos SOLO estos tamaños: 22, 25, 27, 30 (NO 15 ni 20)
- Cada pallet puede contener hasta 24 packets
- Usamos 3 turnos: DS (Day Shift 6:00-14:30), TW (Twilight 14:30-23:00), NS (Night Shift 23:00-6:00)
- Zona horaria: Pacific/Auckland (Nueva Zelanda)

ESTRUCTURA REAL DE LA BASE DE DATOS:
1. packets: Cada registro de producción con iso_number (único por tamaño), size (22,25,27,30), thermoformer_number (1,2), shift (DS/TW/NS), raw_materials, batch_number, box_number, pallet_id, packet_index (1-24), created_at
2. pallets: Contenedores para packets con pallet_number (contador global), size (22,25,27,30), thermoformer_number (1,2), opened_at, closed_at
3. raw_pallets: Inventario de materia prima con supplier, pallet_no, stock_code, batch_number, sticker_date, rolls_total (siempre 4), rolls_used
4. rolls: Rollos escaneados en intake con thermoformer_number, raw_materials, batch_number, box_number, photo_path
5. sizes: Configuración de tamaños disponibles (22, 25, 27, 30)
6. shifts: DS/TW/NS con horarios específicos
7. iso_counters: Último número ISO generado por tamaño
8. pallet_counter: Contador global de pallets

REGLAS IMPORTANTES:
- NUNCA menciones tamaños 15 o 20 - no existen en nuestro sistema
- Usa SIEMPRE los tamaños reales: 22, 25, 27, 30
- Los números ISO son únicos por tamaño (no globales)
- Los números de pallet son globales para todos los tamaños y thermoformers
- Cada raw pallet inicia con 4 rolls, rolls_used disminuye al consumirse

INSTRUCCIONES:
- Responde en español de manera natural y conversacional
- Usa SOLO datos reales y tamaños reales (22, 25, 27, 30)
- Si los datos no son suficientes, dilo claramente
- Incluye números específicos cuando sea posible
- Menciona fechas y horas cuando sea relevante
- Explica conceptos del proceso basándote en la estructura real de la DB

Responde de manera útil y específica basándote en datos REALES y tamaños REALES.
`,

  fr: `
Vous êtes un assistant intelligent pour le système de production Plixies, une entreprise de thermoformage en Nouvelle-Zélande.

INFORMATIONS SUR LE PROCESSUS:
- Nous fabriquons des produits plastiques par thermoformage
- Nous avons 2 thermoformeuses (TH1 et TH2)
- Nous produisons SEULEMENT ces tailles: 22, 25, 27, 30 (PAS 15 ou 20)
- Chaque palette peut contenir jusqu'à 24 paquets
- Nous utilisons 3 équipes: DS (Day Shift 6:00-14:30), TW (Twilight 14:30-23:00), NS (Night Shift 23:00-6:00)
- Fuseau horaire: Pacific/Auckland (Nouvelle-Zélande)

STRUCTURE RÉELLE DE LA BASE DE DONNÉES:
1. packets: Chaque enregistrement de production avec iso_number (unique par taille), size (22,25,27,30), thermoformer_number (1,2), shift (DS/TW/NS), raw_materials, batch_number, box_number, pallet_id, packet_index (1-24), created_at
2. pallets: Conteneurs pour paquets avec pallet_number (compteur global), size (22,25,27,30), thermoformer_number (1,2), opened_at, closed_at
3. raw_pallets: Inventaire matière première avec supplier, pallet_no, stock_code, batch_number, sticker_date, rolls_total (toujours 4), rolls_used

RÈGLES IMPORTANTES:
- NE JAMAIS mentionner les tailles 15 ou 20 - elles n'existent pas dans notre système
- Utilisez TOUJOURS les vraies tailles: 22, 25, 27, 30
- Les numéros ISO sont uniques par taille (pas globaux)
- Les numéros de palettes sont globaux pour toutes les tailles et thermoformeuses

INSTRUCTIONS:
- Répondez naturellement et de manière conversationnelle en français
- Utilisez SEULEMENT les données réelles et tailles réelles (22, 25, 27, 30)
- Si les données sont insuffisantes, dites-le clairement
- Incluez des nombres spécifiques quand possible
- Mentionnez les dates et heures quand pertinent
- Expliquez les concepts du processus basés sur la vraie structure DB

Répondez de manière utile et spécifique basé sur les données RÉELLES et tailles RÉELLES.
`,

  pt: `
Você é um assistente inteligente para o sistema de produção da Plixies, uma empresa de termoformagem na Nova Zelândia.

INFORMAÇÕES DO PROCESSO:
- Fabricamos produtos plásticos usando termoformagem
- Temos 2 termoformadoras (TH1 e TH2)
- Produzimos APENAS estes tamanhos: 22, 25, 27, 30 (NÃO 15 ou 20)
- Cada palete pode conter até 24 pacotes
- Usamos 3 turnos: DS (Day Shift 6:00-14:30), TW (Twilight 14:30-23:00), NS (Night Shift 23:00-6:00)
- Fuso horário: Pacific/Auckland (Nova Zelândia)

ESTRUTURA REAL DO BANCO DE DADOS:
1. packets: Cada registro de produção com iso_number (único por tamanho), size (22,25,27,30), thermoformer_number (1,2), shift (DS/TW/NS), raw_materials, batch_number, box_number, pallet_id, packet_index (1-24), created_at
2. pallets: Contêineres para pacotes com pallet_number (contador global), size (22,25,27,30), thermoformer_number (1,2), opened_at, closed_at
3. raw_pallets: Inventário matéria-prima com supplier, pallet_no, stock_code, batch_number, sticker_date, rolls_total (sempre 4), rolls_used

REGRAS IMPORTANTES:
- NUNCA mencione tamanhos 15 ou 20 - eles não existem em nosso sistema
- Use SEMPRE os tamanhos reais: 22, 25, 27, 30
- Números ISO são únicos por tamanho (não globais)
- Números de palete são globais para todos os tamanhos e termoformadoras

INSTRUÇÕES:
- Responda naturalmente e conversacionalmente em português
- Use SOMENTE dados reais e tamanhos reais (22, 25, 27, 30)
- Se os dados forem insuficientes, diga claramente
- Inclua números específicos quando possível
- Mencione datas e horários quando relevante
- Explique conceitos do processo baseados na estrutura real do DB

Responda de forma útil e específica baseado nos dados REAIS e tamanhos REAIS.
`,

  pa: `
ਤੁਸੀਂ ਪਲਿਕਸੀਜ਼ ਉਤਪਾਦਨ ਪ੍ਰਣਾਲੀ ਲਈ ਇੱਕ ਬੁੱਧੀਮਾਨ ਸਹਾਇਕ ਹੋ, ਨਿਊਜ਼ੀਲੈਂਡ ਵਿੱਚ ਇੱਕ ਥਰਮੋਫਾਰਮਿੰਗ ਕੰਪਨੀ।

ਪ੍ਰਕਿਰਿਆ ਦੀ ਜਾਣਕਾਰੀ:
- ਅਸੀਂ ਥਰਮੋਫਾਰਮਿੰਗ ਦੀ ਵਰਤੋਂ ਕਰਦੇ ਹੋਏ ਪਲਾਸਟਿਕ ਉਤਪਾਦ ਬਣਾਉਂਦੇ ਹਾਂ
- ਸਾਡੇ ਕੋਲ 2 ਥਰਮੋਫਾਰਮਰ ਹਨ (TH1 ਅਤੇ TH2)
- ਅਸੀਂ ਸਿਰਫ਼ ਇਹ ਆਕਾਰ ਬਣਾਉਂਦੇ ਹਾਂ: 22, 25, 27, 30 (15 ਜਾਂ 20 ਨਹੀਂ)
- ਹਰ ਪੈਲੇਟ ਵਿੱਚ 24 ਪੈਕੇਟ ਤੱਕ ਹੋ ਸਕਦੇ ਹਨ
- ਅਸੀਂ 3 ਸ਼ਿਫਟਾਂ ਵਰਤਦੇ ਹਾਂ: DS (Day Shift 6:00-14:30), TW (Twilight 14:30-23:00), NS (Night Shift 23:00-6:00)

ਮਹੱਤਵਪੂਰਨ ਨਿਯਮ:
- ਕਦੇ ਵੀ ਆਕਾਰ 15 ਜਾਂ 20 ਦਾ ਜ਼ਿਕਰ ਨਾ ਕਰੋ - ਇਹ ਸਾਡੇ ਸਿਸਟਮ ਵਿੱਚ ਮੌਜੂਦ ਨਹੀਂ ਹਨ
- ਹਮੇਸ਼ਾ ਅਸਲ ਆਕਾਰ ਵਰਤੋ: 22, 25, 27, 30

ਹਦਾਇਤਾਂ:
- ਪੰਜਾਬੀ ਵਿੱਚ ਕੁਦਰਤੀ ਅਤੇ ਗੱਲਬਾਤ ਦੇ ਤਰੀਕੇ ਨਾਲ ਜਵਾਬ ਦਿਓ
- ਸਿਰਫ਼ ਅਸਲ ਡੇਟਾ ਅਤੇ ਅਸਲ ਆਕਾਰ (22, 25, 27, 30) ਦੀ ਵਰਤੋਂ ਕਰੋ

ਅਸਲ ਡੇਟਾ ਅਤੇ ਅਸਲ ਆਕਾਰਾਂ ਦੇ ਆਧਾਰ 'ਤੇ ਮਦਦਗਾਰ ਜਵਾਬ ਦਿਓ।
`,

  hi: `
आप प्लिक्सीज़ उत्पादन प्रणाली के लिए एक बुद्धिमान सहायक हैं, न्यूजीलैंड में एक थर्मोफॉर्मिंग कंपनी।

प्रक्रिया की जानकारी:
- हम थर्मोफॉर्मिंग का उपयोग करके प्लास्टिक उत्पाद बनाते हैं
- हमारे पास 2 थर्मोफॉर्मर हैं (TH1 और TH2)
- हम केवल ये आकार बनाते हैं: 22, 25, 27, 30 (15 या 20 नहीं)
- प्रत्येक पैलेट में 24 पैकेट तक हो सकते हैं
- हम 3 शिफ्ट का उपयोग करते हैं: DS (Day Shift 6:00-14:30), TW (Twilight 14:30-23:00), NS (Night Shift 23:00-6:00)

महत्वपूर्ण नियम:
- कभी भी आकार 15 या 20 का उल्लेख न करें - ये हमारे सिस्टम में मौजूद नहीं हैं
- हमेशा वास्तविक आकार का उपयोग करें: 22, 25, 27, 30

निर्देश:
- हिंदी में प्राकृतिक और बातचीत के तरीके से जवाब दें
- केवल वास्तविक डेटा और वास्तविक आकार (22, 25, 27, 30) का उपयोग करें

वास्तविक डेटा और वास्तविक आकारों के आधार पर सहायक उत्तर दें।
`
};

// Función para detectar idioma o usar el especificado
function detectLanguage(text: string, specifiedLang?: string): string {
  if (specifiedLang && SYSTEM_PROMPTS[specifiedLang as keyof typeof SYSTEM_PROMPTS]) {
    return specifiedLang;
  }

  // Detección básica por palabras clave
  const langPatterns = {
    es: /\b(qué|cuántos|cómo|dónde|cuándo|por qué|hoy|ayer|mañana|paquetes|pallets)\b/i,
    fr: /\b(qu\'est-ce|combien|comment|où|quand|pourquoi|aujourd\'hui|hier|demain|paquets|palettes)\b/i,
    pt: /\b(o que|quantos|como|onde|quando|por que|hoje|ontem|amanhã|pacotes|paletes)\b/i,
    pa: /[\u0A00-\u0A7F]/,  // Caracteres Gurmukhi
    hi: /[\u0900-\u097F]/,  // Caracteres Devanagari
    en: /\b(what|how many|how|where|when|why|today|yesterday|tomorrow|packets|pallets)\b/i
  };

  for (const [lang, pattern] of Object.entries(langPatterns)) {
    if (pattern.test(text)) {
      return lang;
    }
  }

  return 'en'; // Default a inglés
}

// Sistema de prompts

export const POST: APIRoute = async ({ request }) => {
  try {
    const { messages, language } = await request.json();
    
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), { status: 400 });
    }

    // Obtener la última pregunta del usuario
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return new Response(JSON.stringify({ error: 'No user message found' }), { status: 400 });
    }

    // Detectar idioma
    const detectedLang = detectLanguage(lastMessage.content, language);
    const systemPrompt = SYSTEM_PROMPTS[detectedLang as keyof typeof SYSTEM_PROMPTS] || SYSTEM_PROMPTS.en;

    // Buscar datos relevantes de la base de datos
    const relevantData = await searchRelevantData(lastMessage.content);

    // Crear el contexto con los datos de la DB (adaptado al idioma)
    const contextMessage = getContextMessage(relevantData, detectedLang);

    // Preparar mensajes para OpenAI
    const openaiMessages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'system' as const, content: contextMessage },
      ...messages.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))
    ];

    // Usar streaming de OpenAI
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 1000,
      stream: true,
    });

    // Crear un ReadableStream para el streaming
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              const formattedChunk = `data: ${JSON.stringify({ 
                content, 
                role: 'assistant',
                language: detectedLang
              })}\n\n`;
              controller.enqueue(encoder.encode(formattedChunk));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('AI Chat error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};

// Función para crear mensajes de contexto en diferentes idiomas
function getContextMessage(relevantData: any, language: string) {
  const contexts = {
    en: `
CURRENT PRODUCTION DATA (${relevantData.currentTime}):

AVAILABLE SIZES: ${relevantData.availableSizes.join(', ')} (ONLY these sizes exist)

TODAY'S STATISTICS:
- Packets produced today: ${relevantData.stats.packetsToday}
- Active pallets (open): ${relevantData.stats.activePallets}
- Raw pallets in inventory: ${relevantData.stats.rawPallets}

RECENT PACKETS PRODUCED:
${relevantData.recentPackets.map((p: any) => 
  `- ISO ${p.iso_number}: Size ${p.size}, TH${p.thermoformer_number}, Packet ${p.packet_index}/24 (${new Date(p.created_at).toLocaleString()})`
).join('\n')}

RECENT PALLETS:
${relevantData.palletInfo.slice(0, 5).map((p: any) => 
  `- Pallet #${p.pallet_number}: Size ${p.size}, TH${p.thermoformer_number}, ${p.closed_at ? 'Closed' : 'Open'} (${new Date(p.opened_at).toLocaleString()})`
).join('\n')}

RECENT RAW MATERIAL:
${relevantData.rawPallets.slice(0, 3).map((r: any) => 
  `- Pallet ${r.pallet_no}: ${r.supplier}, Batch ${r.batch_number}, Stock ${r.stock_code}`
).join('\n')}

PRODUCTION BY SIZE (LAST WEEK):
${Object.entries(relevantData.productionBySize).map(([size, count]) => 
  `- Size ${size}: ${count} packets`
).join('\n')}
`,

    es: `
DATOS ACTUALES DE LA PRODUCCIÓN (${relevantData.currentTime}):

TAMAÑOS DISPONIBLES: ${relevantData.availableSizes.join(', ')} (SOLO estos tamaños existen)

ESTADÍSTICAS DE HOY:
- Packets producidos hoy: ${relevantData.stats.packetsToday}
- Pallets activos (abiertos): ${relevantData.stats.activePallets}
- Raw pallets en inventario: ${relevantData.stats.rawPallets}

ÚLTIMOS PACKETS PRODUCIDOS:
${relevantData.recentPackets.map((p: any) => 
  `- ISO ${p.iso_number}: Tamaño ${p.size}, TH${p.thermoformer_number}, Packet ${p.packet_index}/24 (${new Date(p.created_at).toLocaleString()})`
).join('\n')}

PALLETS RECIENTES:
${relevantData.palletInfo.slice(0, 5).map((p: any) => 
  `- Pallet #${p.pallet_number}: Tamaño ${p.size}, TH${p.thermoformer_number}, ${p.closed_at ? 'Cerrado' : 'Abierto'} (${new Date(p.opened_at).toLocaleString()})`
).join('\n')}

MATERIA PRIMA RECIENTE:
${relevantData.rawPallets.slice(0, 3).map((r: any) => 
  `- Pallet ${r.pallet_no}: ${r.supplier}, Batch ${r.batch_number}, Stock ${r.stock_code}`
).join('\n')}

PRODUCCIÓN POR TAMAÑO (ÚLTIMA SEMANA):
${Object.entries(relevantData.productionBySize).map(([size, count]) => 
  `- Tamaño ${size}: ${count} packets`
).join('\n')}
`,

    fr: `
DONNÉES ACTUELLES DE PRODUCTION (${relevantData.currentTime}):

STATISTIQUES D'AUJOURD'HUI:
- Paquets produits aujourd'hui: ${relevantData.stats.packetsToday}
- Palettes actives (ouvertes): ${relevantData.stats.activePallets}
- Palettes de matière première en inventaire: ${relevantData.stats.rawPallets}

DERNIERS PAQUETS PRODUITS:
${relevantData.recentPackets.map((p: any) => 
  `- ISO ${p.iso_number}: Taille ${p.size}, TH${p.thermoformer_number}, Paquet ${p.packet_index}/24 (${new Date(p.created_at).toLocaleString()})`
).join('\n')}

PALETTES RÉCENTES:
${relevantData.palletInfo.slice(0, 5).map((p: any) => 
  `- Palette #${p.pallet_number}: Taille ${p.size}, TH${p.thermoformer_number}, ${p.closed_at ? 'Fermée' : 'Ouverte'} (${new Date(p.opened_at).toLocaleString()})`
).join('\n')}

MATIÈRE PREMIÈRE RÉCENTE:
${relevantData.rawPallets.slice(0, 3).map((r: any) => 
  `- Palette ${r.pallet_no}: ${r.supplier}, Lot ${r.batch_number}, Code stock ${r.stock_code}`
).join('\n')}

PRODUCTION PAR TAILLE (SEMAINE DERNIÈRE):
${Object.entries(relevantData.productionBySize).map(([size, count]) => 
  `- Taille ${size}: ${count} paquets`
).join('\n')}
`,

    pt: `
DADOS ATUAIS DA PRODUÇÃO (${relevantData.currentTime}):

ESTATÍSTICAS DE HOJE:
- Pacotes produzidos hoje: ${relevantData.stats.packetsToday}
- Paletes ativos (abertos): ${relevantData.stats.activePallets}
- Paletes de matéria-prima no inventário: ${relevantData.stats.rawPallets}

ÚLTIMOS PACOTES PRODUZIDOS:
${relevantData.recentPackets.map((p: any) => 
  `- ISO ${p.iso_number}: Tamanho ${p.size}, TH${p.thermoformer_number}, Pacote ${p.packet_index}/24 (${new Date(p.created_at).toLocaleString()})`
).join('\n')}

PALETES RECENTES:
${relevantData.palletInfo.slice(0, 5).map((p: any) => 
  `- Palete #${p.pallet_number}: Tamanho ${p.size}, TH${p.thermoformer_number}, ${p.closed_at ? 'Fechado' : 'Aberto'} (${new Date(p.opened_at).toLocaleString()})`
).join('\n')}

MATÉRIA-PRIMA RECENTE:
${relevantData.rawPallets.slice(0, 3).map((r: any) => 
  `- Palete ${r.pallet_no}: ${r.supplier}, Lote ${r.batch_number}, Código estoque ${r.stock_code}`
).join('\n')}

PRODUÇÃO POR TAMANHO (ÚLTIMA SEMANA):
${Object.entries(relevantData.productionBySize).map(([size, count]) => 
  `- Tamanho ${size}: ${count} pacotes`
).join('\n')}
`,

    pa: `
ਮੌਜੂਦਾ ਉਤਪਾਦਨ ਡੇਟਾ (${relevantData.currentTime}):

ਅੱਜ ਦੇ ਅੰਕੜੇ:
- ਅੱਜ ਪੈਦਾ ਕੀਤੇ ਪੈਕੇਟ: ${relevantData.stats.packetsToday}
- ਸਰਗਰਮ ਪੈਲੇਟ (ਖੁੱਲੇ): ${relevantData.stats.activePallets}
- ਇਨਵੈਂਟਰੀ ਵਿੱਚ ਕੱਚੇ ਮਾਲ ਦੇ ਪੈਲੇਟ: ${relevantData.stats.rawPallets}

ਹਾਲ ਹੀ ਵਿੱਚ ਪੈਦਾ ਕੀਤੇ ਪੈਕੇਟ:
${relevantData.recentPackets.map((p: any) => 
  `- ISO ${p.iso_number}: ਸਾਈਜ਼ ${p.size}, TH${p.thermoformer_number}, ਪੈਕੇਟ ${p.packet_index}/24 (${new Date(p.created_at).toLocaleString()})`
).join('\n')}

ਹਾਲ ਹੀ ਦੇ ਪੈਲੇਟ:
${relevantData.palletInfo.slice(0, 5).map((p: any) => 
  `- ਪੈਲੇਟ #${p.pallet_number}: ਸਾਈਜ਼ ${p.size}, TH${p.thermoformer_number}, ${p.closed_at ? 'ਬੰਦ' : 'ਖੁੱਲਾ'} (${new Date(p.opened_at).toLocaleString()})`
).join('\n')}

ਹਾਲ ਹੀ ਦਾ ਕੱਚਾ ਮਾਲ:
${relevantData.rawPallets.slice(0, 3).map((r: any) => 
  `- ਪੈਲੇਟ ${r.pallet_no}: ${r.supplier}, ਬੈਚ ${r.batch_number}, ਸਟਾਕ ਕੋਡ ${r.stock_code}`
).join('\n')}

ਸਾਈਜ਼ ਅਨੁਸਾਰ ਉਤਪਾਦਨ (ਪਿਛਲਾ ਹਫ਼ਤਾ):
${Object.entries(relevantData.productionBySize).map(([size, count]) => 
  `- ਸਾਈਜ਼ ${size}: ${count} ਪੈਕੇਟ`
).join('\n')}
`,

    hi: `
वर्तमान उत्पादन डेटा (${relevantData.currentTime}):

आज के आंकड़े:
- आज उत्पादित पैकेट: ${relevantData.stats.packetsToday}
- सक्रिय पैलेट (खुले): ${relevantData.stats.activePallets}
- इन्वेंट्री में कच्चे माल के पैलेट: ${relevantData.stats.rawPallets}

हाल ही में उत्पादित पैकेट:
${relevantData.recentPackets.map((p: any) => 
  `- ISO ${p.iso_number}: साइज़ ${p.size}, TH${p.thermoformer_number}, पैकेट ${p.packet_index}/24 (${new Date(p.created_at).toLocaleString()})`
).join('\n')}

हालिया पैलेट:
${relevantData.palletInfo.slice(0, 5).map((p: any) => 
  `- पैलेट #${p.pallet_number}: साइज़ ${p.size}, TH${p.thermoformer_number}, ${p.closed_at ? 'बंद' : 'खुला'} (${new Date(p.opened_at).toLocaleString()})`
).join('\n')}

हालिया कच्चा माल:
${relevantData.rawPallets.slice(0, 3).map((r: any) => 
  `- पैलेट ${r.pallet_no}: ${r.supplier}, बैच ${r.batch_number}, स्टॉक कोड ${r.stock_code}`
).join('\n')}

साइज़ के अनुसार उत्पादन (पिछला सप्ताह):
${Object.entries(relevantData.productionBySize).map(([size, count]) => 
  `- साइज़ ${size}: ${count} पैकेट`
).join('\n')}
`
  };

  return contexts[language as keyof typeof contexts] || contexts.en;
}
