import 'dotenv/config';
import mqtt from "mqtt";
import fetch from "node-fetch";

// Config
const MQTT_BROKER = "wss://7fdaf087830f41a89eb6ae69bd0e592f.s1.eu.hivemq.cloud:8884/mqtt";
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_TOPIC = "sensor/data";
const VERCEL_API_URL = "https://backend-redis-iota.vercel.app/api/vitals/upload";

// MQTT connection options
const options = {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  protocol: "wss",
  wsOptions: { protocol: "mqtt" },
  reconnectPeriod: 5000,
  connectTimeout: 30 * 1000
};

// Connect MQTT
const client = mqtt.connect(MQTT_BROKER, options);

// Events
client.on("connect", () => {
  console.log(new Date().toISOString(), "MQTT Connected");
  client.subscribe(MQTT_TOPIC, (err) => {
    if (err) console.error(new Date().toISOString(), "Subscribe error:", err);
    else console.log(new Date().toISOString(), `Subscribed to topic: ${MQTT_TOPIC}`);
  });
});

client.on("reconnect", () => console.log(new Date().toISOString(), "MQTT Reconnecting..."));
client.on("offline", () => console.log(new Date().toISOString(), "MQTT Offline"));
client.on("error", (err) => console.error(new Date().toISOString(), "MQTT Error:", err.message));

// Handle incoming messages
client.on("message", async (topic, message) => {
  let payload;
  try {
    payload = JSON.parse(message.toString());
  } catch (err) {
    console.error(new Date().toISOString(), "Invalid JSON from MQTT:", message.toString());
    return; // skip bad messages
  }

  // Map payload to API format
  const apiBody = {
    patientId: payload.patientId || "defaultPatientId",
    heartRate: payload.heartRate,
    spo2: payload.spo2,
    temperature: payload.temperature
  };

  console.log(new Date().toISOString(), `Forwarding to API:`, apiBody);

  // Send to Vercel API
  try {
    const res = await fetch(VERCEL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiBody)
    });

    if (!res.ok) console.error(new Date().toISOString(), "Failed to forward to Vercel API:", res.statusText);
  } catch (err) {
    console.error(new Date().toISOString(), "Error posting to Vercel API:", err.message);
  }
});
