# Configuración de Operación Enigma - Fase 1

## 1. Configurar firebase.js
Abre el archivo `firebase.js` y reemplaza el objeto `firebaseConfig` con el tuyo.
Puedes encontrarlo en: Firebase Console > Configuración del Proyecto > General > Tus aplicaciones > SDK setup y configuración.

```javascript
const firebaseConfig = {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    // ...
};
```

## 2. Crear Estructura en Firestore
Para que la validación funcione, debes crear manualmente (o mediante script) la siguiente estructura en tu base de datos Firestore:

**Colección:** `grupos`
  **Documento:** `2026-02-17` (Usa la fecha de HOY en formato YYYY-MM-DD para probar)
    **Subcolección:** `integrantes`
      **Documento:** `usuario_prueba_1` (ID automático o manual)
        - `codigo_individual`: "A1B2" (String)
        - `validado`: false (Boolean)

### Ejemplo visual:
```
grupos/
  └── 2026-02-17
        └── integrantes/
              └── usuario_prueba_1
                    ├── codigo_individual: "A1B2"
                    └── validado: false
```

## 3. Probar la App
1. Abre `index.html` en tu navegador.
2. Verás la interfaz de "Terminal".
3. Cuando te pida el código, introduce `A1B2`.
4. Debería decir "ACCESO AUTORIZADO" y actualizar el campo `validado` a `true` en Firestore.
5. Si recargas la página, debería recordar que ya estás validado.
