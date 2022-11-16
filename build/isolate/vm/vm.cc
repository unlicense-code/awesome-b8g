#include "vm.h"

void NAMESPACE::vm::CreateContext(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<ObjectTemplate> global = ObjectTemplate::New(isolate);
  bool allowCodeGen = false;
  if (args.Length() > 0) allowCodeGen = args[0]->BooleanValue(isolate);
  Local<ObjectTemplate> context = ObjectTemplate::New(isolate);
  context->SetInternalFieldCount(2);
  NAMESPACE::Init(isolate, context);
  Local<String> name = String::NewFromUtf8Literal(isolate, "context", 
      NewStringType::kInternalized);
  global->Set(name, context);
  Local<Context> context = Context::New(isolate, NULL, global);
  context->AllowCodeGenerationFromStrings(allowCodeGen);
  isolate->SetPromiseRejectCallback(PromiseRejectCallback);
  Local<Object> globalInstance = context->Global();
  globalInstance->Set(context, String::NewFromUtf8Literal(isolate, 
    "global", 
    NewStringType::kInternalized), globalInstance).Check();
  Local<Value> obj = globalInstance->Get(context, name).ToLocalChecked();
  Local<Object> contextInstance = Local<Object>::Cast(obj);
  v8::Persistent<Context, v8::CopyablePersistentTraits<Context>> pContext(isolate, context);
  v8_context* handle = (v8_context*)calloc(1, sizeof(v8_context));
  handle->context = pContext;
  contextInstance->SetAlignedPointerInInternalField(1, handle);
  args.GetReturnValue().Set(contextInstance);
}

void NAMESPACE::vm::EnterContext(const FunctionCallbackInfo<Value> &args) {
  Local<Object> ab = args[0].As<Object>();
  v8_context* handle = (v8_context*)ab->GetAlignedPointerFromInternalField(1);
  handle->context.Get(args.GetIsolate())->Enter();
}

void NAMESPACE::vm::ExitContext(const FunctionCallbackInfo<Value> &args) {
  Local<Object> ab = args[0].As<Object>();
  v8_context* handle = (v8_context*)ab->GetAlignedPointerFromInternalField(1);
  handle->context.Get(args.GetIsolate())->Exit();
}

void NAMESPACE::vm::CompileInContext(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Object> ab = args[0].As<Object>();
  v8_context* handle = (v8_context*)ab->GetAlignedPointerFromInternalField(1);
  Local<Context> context = handle->context.Get(isolate);
  TryCatch try_catch(isolate);
  Local<String> source = args[1].As<String>();
  Local<String> path = args[2].As<String>();
  Local<v8::PrimitiveArray> opts =
      v8::PrimitiveArray::New(isolate, 1);
  opts->Set(isolate, 0, v8::Number::New(isolate, 1));
  ScriptOrigin baseorigin(isolate, path, // resource name
    0, // line offset
    0,  // column offset
    false, // is shared cross-origin
    -1,  // script id
    Local<Value>(), // source map url
    false, // is opaque
    false, // is wasm
    false, // is module
    opts);
  Local<Script> script;
  ScriptCompiler::Source basescript(source, baseorigin);
  bool ok = ScriptCompiler::Compile(context, &basescript).ToLocal(&script);
  if (!ok) {
    if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
      try_catch.ReThrow();
    }
    return;
  }
  v8::Persistent<Script, v8::CopyablePersistentTraits<Script>> 
    pScript(isolate, script);
  handle->script = pScript;
}

void NAMESPACE::vm::CompileAndRunInContext(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Object> ab = args[0].As<Object>();
  v8_context* handle = (v8_context*)ab->GetAlignedPointerFromInternalField(1);
  Local<Context> context = handle->context.Get(isolate);
  TryCatch try_catch(isolate);
  Local<String> source = args[1].As<String>();
  Local<String> path = args[2].As<String>();

  Local<v8::PrimitiveArray> opts =
      v8::PrimitiveArray::New(isolate, 1);
  opts->Set(isolate, 0, v8::Number::New(isolate, 1));
  ScriptOrigin baseorigin(isolate, path, // resource name
    0, // line offset
    0,  // column offset
    false, // is shared cross-origin
    -1,  // script id
    Local<Value>(), // source map url
    false, // is opaque
    false, // is wasm
    false, // is module
    opts);
  Local<Script> script;
  ScriptCompiler::Source basescript(source, baseorigin);
  bool ok = ScriptCompiler::Compile(context, &basescript).ToLocal(&script);
  if (!ok) {
    if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
      try_catch.ReThrow();
    }
    return;
  }
  MaybeLocal<Value> result = script->Run(context);
  if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
    try_catch.ReThrow();
    return;
  }
  args.GetReturnValue().Set(result.ToLocalChecked());
}

void NAMESPACE::vm::RunInContext(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Object> ab = args[0].As<Object>();
  v8_context* handle = (v8_context*)ab->GetAlignedPointerFromInternalField(1);
  Local<Context> context = handle->context.Get(isolate);
  Local<Script> script = handle->script.Get(isolate);
  TryCatch try_catch(isolate);
  MaybeLocal<Value> result = script->Run(context);
  if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
    try_catch.ReThrow();
    return;
  }
  args.GetReturnValue().Set(result.ToLocalChecked());
}

void NAMESPACE::vm::CompileScript(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  TryCatch try_catch(isolate);
  Local<String> source = args[0].As<String>();
  Local<String> path = args[1].As<String>();
  Local<Array> params_buf = args[2].As<Array>();
  Local<Array> context_extensions_buf;
  context_extensions_buf = args[3].As<Array>();
  std::vector<Local<String>> params;
  if (!params_buf.IsEmpty()) {
    for (uint32_t n = 0; n < params_buf->Length(); n++) {
      Local<Value> val;
      if (!params_buf->Get(context, n).ToLocal(&val)) return;
      params.push_back(val.As<String>());
    }
  }
  std::vector<Local<Object>> context_extensions;
  if (!context_extensions_buf.IsEmpty()) {
    for (uint32_t n = 0; n < context_extensions_buf->Length(); n++) {
      Local<Value> val;
      if (!context_extensions_buf->Get(context, n).ToLocal(&val)) return;
      context_extensions.push_back(val.As<Object>());
    }
  }
  Local<v8::PrimitiveArray> opts =
      v8::PrimitiveArray::New(isolate, 1);
  opts->Set(isolate, 0, v8::Number::New(isolate, 1));
  ScriptOrigin baseorigin(isolate, path, // resource name
    0, // line offset
    0,  // column offset
    false, // is shared cross-origin
    -1,  // script id
    Local<Value>(), // source map url
    false, // is opaque
    false, // is wasm
    false, // is module
    opts);

  Context::Scope scope(context);
  ScriptCompiler::Source basescript(source, baseorigin);
  MaybeLocal<Function> maybe_fn = ScriptCompiler::CompileFunctionInContext(
    context, &basescript, params.size(), params.data(), 0, nullptr, 
    ScriptCompiler::kEagerCompile);
  if (maybe_fn.IsEmpty()) {
    if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
      try_catch.ReThrow();
    }
    return;
  }
  Local<Function> fn = maybe_fn.ToLocalChecked();
  args.GetReturnValue().Set(fn);
}

void NAMESPACE::vm::RunScript(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetEnteredOrMicrotaskContext();
  TryCatch try_catch(isolate);
  Local<String> source = args[0].As<String>();
  Local<String> path = args[1].As<String>();
  Local<v8::PrimitiveArray> opts =
      v8::PrimitiveArray::New(isolate, 1);
  opts->Set(isolate, 0, v8::Number::New(isolate, 1));
  ScriptOrigin baseorigin(isolate, path, // resource name
    0, // line offset
    0,  // column offset
    false, // is shared cross-origin
    -1,  // script id
    Local<Value>(), // source map url
    false, // is opaque
    false, // is wasm
    false, // is module
    opts);
  Local<Script> script;
  ScriptCompiler::Source basescript(source, baseorigin);
  bool ok = ScriptCompiler::Compile(context, &basescript).ToLocal(&script);
  if (!ok) {
    if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
      try_catch.ReThrow();
    }
    return;
  }
  MaybeLocal<Value> result = script->Run(context);
  if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
    try_catch.ReThrow();
    return;
  }
  args.GetReturnValue().Set(result.ToLocalChecked());
}

void NAMESPACE::vm::RunModule(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope handleScope(isolate);
  Local<Context> context = isolate->GetCurrentContext();
  TryCatch try_catch(isolate);
  Local<String> source = args[0].As<String>();
  Local<String> path = args[1].As<String>();
  Local<v8::PrimitiveArray> opts =
      v8::PrimitiveArray::New(isolate, NAMESPACE::HostDefinedOptions::kLength);
  opts->Set(isolate, NAMESPACE::HostDefinedOptions::kType,
                            v8::Number::New(isolate, NAMESPACE::ScriptType::kModule));
  ScriptOrigin baseorigin(isolate, path, // resource name
    0, // line offset
    0,  // column offset
    true, // is shared cross-origin
    -1,  // script id
    Local<Value>(), // source map url
    false, // is opaque
    false, // is wasm
    true, // is module
    opts);
  ScriptCompiler::Source basescript(source, baseorigin);
  Local<Module> module;
  bool ok = ScriptCompiler::CompileModule(isolate, 
    &basescript).ToLocal(&module);
  if (!ok) {
    if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
      try_catch.ReThrow();
    }
    return;
  }
  Maybe<bool> ok2 = module->InstantiateModule(context, NAMESPACE::OnModuleInstantiate);
  if (ok2.IsNothing()) {
    if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
      try_catch.ReThrow();
    }
    return;
  }
  MaybeLocal<Value> result = module->Evaluate(context);
  if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
    try_catch.ReThrow();
    return;
  }
  args.GetReturnValue().Set(result.ToLocalChecked());
}

void NAMESPACE::vm::Init(Isolate* isolate, Local<ObjectTemplate> target) {
  Local<ObjectTemplate> vm = ObjectTemplate::New(isolate);
  SET_METHOD(isolate, vm, "compile", NAMESPACE::vm::CompileScript);
  SET_METHOD(isolate, vm, "runScript", NAMESPACE::vm::RunScript);
  SET_METHOD(isolate, vm, "runModule", NAMESPACE::vm::RunModule);
  SET_METHOD(isolate, vm, "runInContext", NAMESPACE::vm::RunInContext);
  SET_METHOD(isolate, vm, "compileInContext", NAMESPACE::vm::CompileInContext);
  SET_METHOD(isolate, vm, "compileAndRunInContext", NAMESPACE::vm::CompileAndRunInContext);
  SET_METHOD(isolate, vm, "createContext", NAMESPACE::vm::CreateContext);
  SET_METHOD(isolate, vm, "enterContext", NAMESPACE::vm::EnterContext);
  SET_METHOD(isolate, vm, "exitContext", NAMESPACE::vm::ExitContext);
  SET_MODULE(isolate, target, "vm", vm);
}
