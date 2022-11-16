const { print, error, builtin } = isolates;
const { launch, watch } = isolates.process;
const { cwd } = isolates.sys;
const { compile } = isolates.vm;
const { unlink, isDir, isFile, writeFile, mkdir, rmdir, readDir, chdir, rename } = isolates.fs;

const AD = '\u001b[0m' // ANSI Default
const AG = '\u001b[32m' // ANSI Green
const AY = '\u001b[33m' // ANSI Yellow
const AR = '\u001b[31m' // ANSI Red

function rmrf (dirName) {
  if (!isDir(dirName)) return
  const entries = readDir(dirName)
  for (const entry of entries) {
    const { name } = entry
    if (!name.length || (name === '.' || name === '..')) continue
    if (isFile(`${dirName}/${entry.name}`)) {
      print(`unlink ${dirName}/${entry.name}`)
      unlink(`${dirName}/${entry.name}`)
    }
  }
  rmdir(dirName)
}

function safeWrite (fileName, str) {
  if (!isFile(fileName)) {
    return writeFile(fileName, ArrayBuffer.fromString(str))
  }
  return 0
}

function make (opts, ...args) {
  const currentDir = cwd()
  const { silent } = opts
  if (silent) {
    const process = launch('make', [...args], currentDir)
    process.onStdout = (buf, len) => {}
    process.onStderr = (buf, len) => {}
    return watch(process)
  }
  return watch(launch('make', [...args], currentDir))
}

const rx = /[./-]/g

function linkFile (fileName, name) {
  name = `_binary_${name.replace(rx, '_')}`
  return `.global ${name}_start
${name}_start:
        .incbin "${fileName}"
        .global ${name}_end
${name}_end:
`
}

function generateBuiltins (main, index, libs, embeds, modules, v8flags, v8flagsFromCommandLine = false, isolatesDir = '') {
  const lines = []
  const files = libs.concat(embeds)
  // todo - make this a string literal/template
  for (let file of files) {
    if (file[0] === '/') {
      file = file.replace(`${isolatesDir}/`, '')
    }
    const path = file.replace(rx, '_')
    lines.push(`extern char _binary_${path}_start[];`)
    lines.push(`extern char _binary_${path}_end[];`)
  }
  lines.push('extern "C" {')
  for (const module of modules) {
    if (module.exports) {
      for (const e of module.exports) {
        lines.push(`  extern void* _register_${e.name}();`)
      }
    } else {
      lines.push(`  extern void* _register_${module.name}();`)
    }
  }
  lines.push('}')
  lines.push('void register_builtins() {')
  for (let file of files) {
    if (file[0] === '/') {
      file = file.replace(`${isolatesDir}/`, '')
    }
    const path = file.replace(rx, '_')
    lines.push(`  isolates::builtins_add("${file}", _binary_${path}_start, _binary_${path}_end - _binary_${path}_start);`)
  }
  for (const module of modules) {
    if (module.exports) {
      for (const e of module.exports) {
        lines.push(`  isolates::modules["${e.name}"] = &_register_${e.name};`)
      }
    } else {
      lines.push(`  isolates::modules["${module.name}"] = &_register_${module.name};`)
    }
  }
  lines.push('}')
  let path = main.replace(rx, '_')
  lines.push(`static unsigned int isolates_js_len = _binary_${path}_end - _binary_${path}_start;`)
  lines.push(`static const char* isolates_js = _binary_${path}_start;`)
  if (index) {
    path = index.replace(rx, '_')
    lines.push(`static unsigned int index_js_len = _binary_${path}_end - _binary_${path}_start;`)
    lines.push(`static const char* index_js = _binary_${path}_start;`)
    lines.push('static unsigned int _use_index = 1;')
  } else {
    path = index.replace(rx, '_')
    lines.push('static unsigned int index_js_len = 0;')
    lines.push('static const char* index_js = NULL;')
    lines.push('static unsigned int _use_index = 0;')
  }
  lines.push(`static const char* v8flags = "${v8flags}";`)
  lines.push(`static unsigned int _v8flags_from_commandline = ${v8flagsFromCommandLine ? 1 : 0};`)
  return lines.join('\n')
}

function requireText (text, fileName = 'eval', dirName = cwd()) {
  const params = ['exports', 'require', 'module']
  const exports = {}
  const module = { exports, dirName, fileName, type: 'js' }
  module.text = text
  const fun = compile(module.text, fileName, params, [])
  module.function = fun
  fun.call(exports, exports, p => require(p, module), module)
  return module.exports
}

async function run (config = {}, { cleanall = false, clean = false, dump = false, silent = false }) {
  // TODO: remove dependency on Date
  const start = Date.now()
  let build = 'main'
  let moduleBuild = 'module'
  const text = builtin('config.js')
  if (!text) {
    error('config.js missing')
    return
  }
  const { HOME, ISOLATES_TARGET, CFLAGS = '', LFLAGS = '' } = isolates.env()
  const isolatesDir = ISOLATES_TARGET || `${HOME}/.isolates`
  const appDir = cwd()
  const runtime = requireText(text)
  const {
    version = runtime.version || isolates.version.isolates,
    debug = runtime.debug || false,
    modules = runtime.modules || [],
    flags = runtime.flags || '',
    v8flagsFromCommandLine = runtime.v8flagsFromCommandLine || false,
    v8flags = runtime.v8flags || '',
    target = runtime.target || 'isolates',
    main = runtime.main || 'isolates.js',
    index = runtime.index || ''
  } = config
  if (config.static === 'undefined') {
    config.static = runtime.static
  }
  if (config.static) {
    build = 'main-static'
    moduleBuild = 'module-static'
  }
  config.libs = config.libs || []
  config.embeds = config.embeds || []
  const links = {}
  if (config.target === 'isolates') {
    for (const fileName of config.libs) {
      if (isFile(`${appDir}/${fileName}`)) {
        links[fileName] = linkFile(fileName, fileName)
      } else {
        links[fileName] = linkFile(`${isolatesDir}/${fileName}`, fileName)
      }
    }
    for (const fileName of config.embeds) {
      if (isFile(`${appDir}/${fileName}`)) {
        links[fileName] = linkFile(fileName, fileName)
      } else {
        links[fileName] = linkFile(`${isolatesDir}/${fileName}`, fileName)
      }
    }
  } else {
    for (const fileName of config.libs) {
      if (fileName[0] === '/') {
        links[fileName] = linkFile(fileName, fileName.replace(`${isolatesDir}/`, ''))
      } else {
        if (isFile(`${appDir}/${fileName}`)) {
          links[fileName] = linkFile(`${appDir}/${fileName}`, fileName)
        } else {
          links[fileName] = linkFile(`${isolatesDir}/${fileName}`, fileName)
        }
      }
    }
    for (const fileName of config.embeds) {
      links[fileName] = linkFile(`${appDir}/${fileName}`, fileName)
    }
  }
  if (main === 'isolates.js') {
    for (const fileName of runtime.libs) {
      links[fileName] = linkFile(fileName, fileName)
    }
    for (const fileName of runtime.embeds) {
      links[fileName] = linkFile(fileName, fileName)
    }
    config.embeds = [...new Set([...config.embeds, ...[main, 'config.js']])]
    if (config.target !== 'isolates') {
      runtime.libs = runtime.libs.filter(lib => {
        if (lib === 'lib/build.js') return false
        if (lib === 'lib/repl.js') return false
        if (lib === 'lib/configure.js') return false
        if (lib === 'lib/acorn.js') return false
        return true
      })
    }
    config.libs = [...new Set([...config.libs, ...runtime.libs])]
    if (index) {
      links[index] = linkFile(`${appDir}/${index}`, index)
      if (config.target === 'isolates') {
        config.embeds = [...new Set([...config.embeds, ...runtime.embeds, ...[index]])]
      } else {
        config.embeds = [...new Set([...config.embeds, ...[index]])]
      }
    } else {
      if (config.target === 'isolates') {
        config.embeds = [...new Set([...config.embeds, ...runtime.embeds])]
      }
    }
  } else {
    config.embeds = [...new Set([...config.embeds, ...[main]])]
    links[main] = linkFile(`${appDir}/${main}`, main)
  }
  config.embeds = config.embeds.filter(embed => !(config.libs.indexOf(embed) > -1))
  config.modules = modules
  if (debug) {
    build = `${build}-debug`
    moduleBuild = `${moduleBuild}-debug`
  }
  config.LIBS = config.libs.join(' ')
  config.EMBEDS = config.embeds.join(' ')
  config.MODULES = modules.map(m => (m.exports ? (m.exports.map(e => e.obj).flat()) : m.obj)).flat().join(' ')
  config.LIB = modules.map(m => m.lib).flat().filter(v => v).map(v => `-l${v}`).join(' ')
  config.isolatesDir = isolatesDir
  if (dump) {
    config.build = build
    config.moduleBuild = moduleBuild
    return config
  }
  if (config.target !== 'isolates') {
    if (!isDir(isolatesDir)) mkdir(isolatesDir)
    chdir(isolatesDir)
  }
  if (config.main === 'isolates.js') {
    if (!isFile('isolates.js')) writeFile('isolates.js', ArrayBuffer.fromString(builtin('isolates.js')))
    if (!isFile('config.js')) writeFile('config.js', ArrayBuffer.fromString(builtin('config.js')))
  }
  writeFile('builtins.S', ArrayBuffer.fromString(Object.keys(links).map(k => links[k]).join('')))
  if (!isDir('lib')) mkdir('lib')
  const src = generateBuiltins(main, index, config.libs, config.embeds, modules, v8flags, v8flagsFromCommandLine, isolatesDir)
  writeFile('main.h', ArrayBuffer.fromString(src))
  for (const fileName of runtime.embeds) {
    if (!isFile(fileName)) {
      writeFile(fileName, ArrayBuffer.fromString(builtin(fileName)))
    }
  }
  for (const lib of runtime.libs) {
    if (!isFile(lib)) {
      writeFile(lib, ArrayBuffer.fromString(builtin(lib)))
    }
  }
  if (!isFile('deps/v8/libv8_monolith.a')) {
    print(`${AG}get v8 static library${AD} `, false)
    const p = await make({ silent }, 'deps/v8/libv8_monolith.a')
    const status = p.status ? `${AR}failed${AD}` : `${AG}complete${AD}`
    // TODO: remove dependency on Date
    print(`${status} in ${AY}${Math.floor((Date.now() - start) / 10) / 100}${AD} sec`)
  }
  if (modules.length && !isDir('modules')) {
    print(`${AG}get modules${AD} `, false)
    const p = await make({ silent }, 'modules')
    const status = p.status ? `${AR}failed${AD}` : `${AG}complete${AD}`
    // TODO: remove dependency on Date
    print(`${status} in ${AY}${Math.floor((Date.now() - start) / 10) / 100}${AD} sec`)
  }
  if (clean) {
    print(`${AG}clean ${target}${AD} `, false)
    const p = await make({ silent }, `TARGET=${target}`, 'clean')
    const status = p.status ? `${AR}failed${AD}` : `${AG}complete${AD}`
    // TODO: remove dependency on Date
    print(`${status} in ${AY}${Math.floor((Date.now() - start) / 10) / 100}${AD} sec`)
  }
  for (const module of modules) {
    if (cleanall) {
      print(`${AG}clean modules/${module.name}${AD} `, false)
      const p = await make({ silent }, '-C', `modules/${module.name}`, 'clean')
      const status = p.status ? `${AR}failed${AD}` : `${AG}complete${AD}`
      // TODO: remove dependency on Date
      print(`${status} in ${AY}${Math.floor((Date.now() - start) / 10) / 100}${AD} sec`)
    }
    if (!isFile(`./modules/${module.name}/${module.name}.o`)) {
      print(`${AG}build modules/${module.name}${AD} `, false)
      const p = await make({ silent }, `MODULE=${module.name}`, `CFLAGS=${CFLAGS}`, `LFLAGS=${LFLAGS}`, moduleBuild)
      const status = p.status ? `${AR}failed${AD}` : `${AG}complete${AD}`
      // TODO: remove dependency on Date
      print(`${status} in ${AY}${Math.floor((Date.now() - start) / 10) / 100}${AD} sec`)
    }
  }
  print(`${AG}build ${target}${AD} ${AY}${version}${AD} (${main}) `, false)
  const p = await make({ silent }, `FLAGS=${flags}`, `EMBEDS=${config.EMBEDS}`, `MAIN=${main}`, `RELEASE=${version}`, `LIBS=${config.LIBS}`, `MODULES=${config.MODULES}`, `TARGET=${target}`, `LIB=${config.LIB}`, `CFLAGS=${CFLAGS}`, `LFLAGS=${LFLAGS}`, build)
  const status = p.status ? `${AR}failed${AD}` : `${AG}complete${AD}`
  // TODO: remove dependency on Date
  print(`${status} in ${AY}${Math.floor((Date.now() - start) / 10) / 100}${AD} sec`)
  if (config.target !== 'isolates') {
    chdir(appDir)
    rename(`${isolatesDir}/${target}`, `${appDir}/${target}`)
  }
}

function init (name) {
  if (!isDir(name)) {
    mkdir(name)
  }
  chdir(name)
  safeWrite('config.json', JSON.stringify({ target: name, index: `${name}.js`, static: true }, null, '  '))
  safeWrite(`${name}.js`, 'isolates.print(isolates.memoryUsage().rss)\n')
  chdir('../')
}

// function clean () {
//   // we don't want to do this for main build
//   // todo unlink linker file
//   unlink('Makefile')
//   unlink('isolates.js')
//   unlink('isolates.cc')
//   unlink('isolates.h')
//   unlink('main.cc')
//   unlink('main.h')
//   unlink('v8lib-0.0.6.tar.gz')
//   unlink('modules.tar.gz')
//   if (isDir('modules')) {
//     unlink('modules/build.js')
//     unlink('modules/fs.js')
//     unlink('modules/inspector.js')
//     unlink('modules/loop.js')
//     unlink('modules/path.js')
//     unlink('modules/process.js')
//     unlink('modules/repl.js')
//     unlink('modules/websocket.js')
//     unlink('modules/acorn.js')
//     unlink('modules/configure.js')
//     const files = readDir('modules').filter(f => !(['.', '..'].indexOf(f.name) > -1))
//     if (files.length === 0) {
//       rmrf('modules')
//     }
//   }
//   if (isDir('config')) {
//     unlink('config.js')
//     unlink('config/debugger.js')
//     const files = readDir('config').filter(f => !(['.', '..'].indexOf(f.name) > -1))
//     if (files.length === 0) {
//       rmrf('config')
//     }
//   }
// }
