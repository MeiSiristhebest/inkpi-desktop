// 一次性诊断脚本：连到 Tauri 窗口的 WebView2 CDP 端点，读算项面的实测值。
// 用法：node .ime-cdp-check.mjs [--type]
// --type 会额外用 CDP Input.imeSetComposition 在真实 WebView2 里注入组合文本。
const WITH_TYPE = process.argv.includes('--type')
const PORT = process.env.CDP_PORT ?? '9223'

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = list.find((t) => t.type === 'page' && t.url.includes('ime.html'))
if (!page) {
  console.log('NO ime.html TARGET. Found:', JSON.stringify(list.map((t) => `${t.type} ${t.url}`), null, 2))
  process.exit(1)
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})

let id = 0
const pending = new Map()
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  const p = pending.get(msg.id)
  if (p) {
    pending.delete(msg.id)
    p(msg.error ? new Error(JSON.stringify(msg.error)) : null, msg.result)
  }
}
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const n = ++id
    pending.set(n, (err, out) => (err ? rej(err) : res(out)))
    ws.send(JSON.stringify({ id: n, method, params }))
    setTimeout(() => {
      if (pending.delete(n)) rej(new Error(`CDP timeout after 5s: ${method}`))
    }, 5000).unref?.()
  })

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
  return r.result.value
}

console.log('UA:', page.url, '|', await evaluate('navigator.userAgent'))

const probe = `(() => {
  const q = (s) => document.querySelector(s);
  const dd = [...document.querySelectorAll('dd')].map(e => e.textContent.trim());
  const fs = getComputedStyle(q('.ink-editor .ProseMirror') || document.body);
  return {
    stall: dd[0],
    compositionEvents: dd[1],
    surfaces: ['input[aria-label]', '[contenteditable]', '.ink-editor .ProseMirror'].map(s => !!q(s)),
    editorText: q('.ink-editor .ProseMirror')?.textContent.slice(0, 18) ?? null,
    editorFont: fs.fontFamily.split(',')[0] + ' ' + fs.fontSize + '/' + fs.lineHeight,
    wenkaiReady: document.fonts.check('17px "LXGW WenKai Screen"', '红楼梦判词'),
    log: [...document.querySelectorAll('li')].slice(0, 8).map(li => li.textContent.trim()),
  };
})()`

const t0 = performance.now()
console.log('PROBE:', JSON.stringify(await evaluate(probe), null, 2))
console.log(`CDP round-trip: ${(performance.now() - t0).toFixed(1)} ms`)

if (WITH_TYPE) {
  // 聚焦第 3 个用例（Tiptap），注入组合文本再看是否落在生产编辑器里。
  await evaluate(`document.querySelector('.ink-editor .ProseMirror').focus()`)
  await send('Input.imeSetComposition', {
    text: '红楼梦',
    selectionStart: 3,
    selectionEnd: 3,
  })
  console.log('AFTER imeSetComposition:', JSON.stringify(await evaluate(
    `(() => ({ text: document.querySelector('.ink-editor .ProseMirror').textContent.slice(0,40),
               events: [...document.querySelectorAll('dd')][1].textContent.trim() }))()`
  )))
  await send('Input.insertText', { text: '判词' })
  console.log('AFTER insertText:', JSON.stringify(await evaluate(
    `(() => ({ text: document.querySelector('.ink-editor .ProseMirror').textContent.slice(0,40) }))()`
  )))
}

ws.close()
