# Forest Design System v1.0

CSS portable con todas las reglas de diseño de Forest Coffee. Drop-in para cualquier app HTML.

---

## Instalación

### 1. Agrega las fuentes en el `<head>`

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=Montserrat:wght@300;400;500;600;700&family=DM+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### 2. Agrega el CSS

```html
<link rel="stylesheet" href="forest-design-system.css">
```

Listo. Ya tienes todos los tokens y componentes disponibles.

---

## Uso

### Aplicar a tu app shell

```html
<body class="fc-body fc-reset">
  <div class="fc-app">
    <aside class="fc-sidebar"> ... </aside>
    <div class="fc-app-main">
      <div class="fc-topbar"> ... </div>
      <div class="fc-content"> ... </div>
    </div>
  </div>
</body>
```

### Tokens disponibles (CSS custom properties)

Todos los tokens van con prefijo `--fc-`. Ejemplos:

```css
.mi-clase {
  background: var(--fc-navy);
  color: var(--fc-yellow);
  font-family: var(--fc-font-display);
  font-size: var(--fc-fs-24);
  letter-spacing: var(--fc-ls-eyebrow);
  padding: var(--fc-space-6) var(--fc-space-8);
  border-radius: var(--fc-radius-3);
  box-shadow: var(--fc-shadow-2);
  transition: all var(--fc-dur-base) var(--fc-ease-out);
}
```

### Componentes pre-armados

| Componente | Clases |
|---|---|
| Sidebar colapsable | `.fc-sidebar`, `.fc-sidebar-link`, `.fc-sidebar-footer` |
| Topbar slim | `.fc-topbar`, `.fc-topbar-page-title` |
| Hamburger mobile (navy con white icon) | `.fc-mobile-toggle` |
| Bottom nav mobile | `.fc-bottom-nav` |
| Hero card navy headline (KC-style) | `.fc-hero-card.featured` |
| Hero card navy headline (FX-style, teal) | `.fc-hero-card.featured-fx` |
| Hero card lateral con border-left semantic | `.fc-hero-card.alert-side.is-crit/.is-warn/.is-ok` |
| P&L strip horizontal con featured tail | `.fc-pnl-strip` con `.fc-pnl-cell.featured` |
| Alertas lavanda blue | `.fc-alert.critical/.ok` |
| Stat cards limpias | `.fc-stat-card` con `.fc-tag-mini.put/.call` |
| Botones | `.fc-btn-primary/.fc-btn-navy/.fc-btn-ghost/.fc-btn-cta` |
| Eyebrow labels | `.fc-eyebrow` |
| Numbers monospace | `.fc-mono`, `.fc-num` |

---

## Reglas no-negociables del brand

1. **No emojis.** Usa Lucide icons (CDN: `https://unpkg.com/lucide@latest/dist/umd/lucide.min.js`) con stroke 1.5–2.5
2. **No gradients.** Solo flat fills + radial sutil en featured cards (decorativo)
3. **Display siempre uppercase + wide-tracked** (`var(--fc-ls-display)` o `var(--fc-ls-eyebrow)`)
4. **Numbers siempre monospace** (`var(--fc-font-mono)`)
5. **Body siempre Montserrat** (`var(--fc-font-body)`), nunca bold (max semibold 600)
6. **Paleta cerrada:** yellow / blue / navy / ink / paper. NO púrpuras, teals (excepto FX), greens random
7. **Cards sobre fondo cream** (`var(--fc-cream)`), nunca blanco puro como ground
8. **Alertas en lavender blue** (`var(--fc-blue-100)`), no en blanco
9. **Hero featured cards SIEMPRE navy** con yellow (KC) o teal (FX) accent
10. **Padding generoso:** desktop 32/48px, tablet 24px, mobile 14px

---

## Sistema de jerarquía visual

Cada dashboard debe tener **1 hero card navy** = la métrica más importante.

- KC: `Hedge Global %`
- FX: `Cobertura FX %`
- App nueva: tu equivalente a "la métrica que requiere acción inmediata"

Las P&L strips siempre tienen el **último cell featured** (la "conclusión"):
- KC: P&L Neto Total (yellow on navy)
- FX: Tasa Efectiva incl. forwards (teal on navy)

---

## Responsive breakpoints

```
mobile:   < 768px
tablet:   768–1023px
desktop:  ≥ 1024px
wide:     ≥ 1440px (max-width container)
```

---

## Versionamiento

- v1.0 — base initial extracted from Forest Coffee CTRM
- Cuando agregues componentes a tu nueva app, edita este archivo y bump la version

---

## Bonus: archivo de referencia visual

Si quieres una página viva con todos los componentes mostrados, abre el index.html del CTRM y usa los devtools para inspeccionar. Cada componente tiene comentario `/* ╔ N. NOMBRE ╚ */` que te lleva al CSS exacto.
