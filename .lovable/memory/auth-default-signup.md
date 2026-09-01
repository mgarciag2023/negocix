---
name: Auth default to signup
description: Auth page must default to "Criar conta" (not login), with intuitive copy for buyers who just purchased
type: preference
---
The /auth page must always open on the "Criar conta" (signup) form by default, never on login. Signup mode must include the highlighted box "Acabou de comprar? Você está no lugar certo!" guiding new buyers to fill email + create password.
**Why:** Most visitors are new buyers activating access; login-first caused confusion.
**How to apply:** Keep `useState(false)` for isLogin in src/pages/Auth.tsx and keep the guidance box in signup mode.
