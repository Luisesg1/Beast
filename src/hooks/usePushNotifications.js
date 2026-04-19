// src/hooks/usePushNotifications.js
// Registra el FCM token al iniciar la app y maneja notificaciones entrantes.
// Uso: llama usePushNotifications(user) en App.jsx cuando el user esté listo.

import { useEffect } from "react";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();
const saveFcmToken = httpsCallable(functions, "saveFcmToken");

export function usePushNotifications(user) {
  useEffect(() => {
    // Solo en dispositivos nativos (Android/iOS), no en web
    if (!Capacitor.isNativePlatform()) return;
    if (!user?.uid) return;

    async function registerPush() {
      try {
        // 1. Pedir permiso
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== "granted") {
          return;
        }

        // 2. Registrar con FCM
        await PushNotifications.register();

        // 3. Cuando FCM devuelve el token, guardarlo en Firestore vía Cloud Function
        await PushNotifications.addListener("registration", async (token) => {
          try {
            await saveFcmToken({ token: token.value });
          } catch (e) {
            console.error("[Push] Error guardando token:", e);
          }
        });

        // 4. Error de registro
        await PushNotifications.addListener("registrationError", (err) => {
          console.error("[Push] Error de registro:", err);
        });

        // 5. Notificación recibida con la app en primer plano
        await PushNotifications.addListener("pushNotificationReceived", (notification) => {
          // Aquí puedes mostrar un toast/banner propio si quieres
          // Android muestra la notificación del sistema
        });

        // 6. Usuario toca la notificación
        await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const data = action.notification.data || {};

          // Navegar según el tipo de notificación
          if (data.type === "routine_assigned") {
            // Puedes emitir un evento o usar un estado global para abrir la tab correcta
            window.dispatchEvent(new CustomEvent("push:routine_assigned", { detail: data }));
          } else if (data.type === "coach_feedback") {
            window.dispatchEvent(new CustomEvent("push:coach_feedback", { detail: data }));
          }
        });

      } catch (e) {
        console.error("[Push] Error registrando push:", e);
      }
    }

    registerPush();

    // Cleanup al desmontar
    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [user?.uid]);
}