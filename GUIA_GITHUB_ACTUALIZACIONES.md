# Actualizaciones por GitHub

## 1. Crear repositorio

1. Crea un repositorio en GitHub, por ejemplo `constru-presupuestos-pro`.
2. Sube estos archivos del proyecto al repositorio.
3. Mantén privado o público el repositorio según prefieras.

## 2. Configurar la app instalada

En la app abre:

`Ayuda > Configurar GitHub Updates`

Se abrirá el archivo:

`Documentos\Constru Presupuestos PRO\github-update.json`

Edita el contenido con tu usuario y repositorio:

```json
{
  "owner": "TU_USUARIO_REAL",
  "repo": "constru-presupuestos-pro",
  "enabled": true
}
```

Guarda el archivo.

## 3. Publicar una actualización

Cada versión nueva debe tener un número mayor en `package.json`, por ejemplo:

```json
"version": "7.2.0"
```

Luego en GitHub crea un tag:

```powershell
git tag v7.2.0
git push origin v7.2.0
```

GitHub Actions generará el instalador y lo adjuntará al Release.

## 4. Actualizar desde la app

En la app:

`Ayuda > Buscar actualizaciones`

La app revisará GitHub. Si falla internet o GitHub no está configurado, seguirá revisando la carpeta local:

`Documentos\Constru Presupuestos PRO\Actualizaciones`

## Nota sobre varios PCs y celular

GitHub sirve muy bien para actualizar la app, pero no es una base de datos para trabajar varias personas al mismo tiempo.

Para trabajar desde varios PCs o celular con respaldo y edición simultánea, la siguiente etapa debe ser un modo nube con:

- usuarios
- base de datos compartida
- respaldo automático
- control de cambios
- una versión web/PWA para celular

Opciones recomendadas: Supabase, Firebase o un servidor propio.
