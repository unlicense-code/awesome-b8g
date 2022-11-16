// As convention the propertys are functions we call them and await the result
export const meta = { 
	// As a convention we always return the result of readdir(path, { rescursive: true });
	readdir: () => ['debian-x64',['v8/Dockerfile']],
	// ('debian-x64/v8/Dockerfile')
	readFile: (path) => path.split('/').reduce((content, key) => content = content[key], content);
}
// The Prefered way to access content is to simply iterate over it while meta should supply lazyHelpers
// Should also use modules MODULE::READFILE prefixed keys indicate a Useable Module 
// content["debian-x64"].v8.Dockerfile
export const content = [{ "x64": { "debian": { "v8": {
    // Highly Annotated Docker File that includes a lot of posix magic by intent to teach you 
    // Importent concepts for porting software that needs a specific OS to build properly.
    // This should later better get a referenced Object like BUILD/DOCKER::SYS::x64::DEBIAN::10.8.xxx::SHA256.js To Reflect better what that builds
    // NOTE: about keys SHASUM needs to get added to the end to be strip able easy in forward search but be there in case of static ref.
    // As OUR BASE IS V8 only the DEBIAN Note is meaningfull as it refers to debian used to build v8 with our deps. also CPU Arch matters.
    // Result: SYS::x64::DEBIAN::10.8.xxx::SHA256.blob SYS::x64::V8::SHA256.blob v8-x64-SHA256.10.8.xxx.blob
    "Dockerfile": `# cat <<'SHA_SUM_CREATION' | sha256sum
# Note that this is exactly what docker build does for each RUN defined layer
# cat <<'EOF' | docker run -i --name sysroot-bullseye-x86_64 debian:bullseye-slim
FROM debian:bullseye-slim
RUN export DEBIAN_FRONTEND=noninteractive \
 && apt-get update -y && apt-get -qq install git curl python lsb-release sudo \
 && git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git \
 && depot_tools/gclient \
 && depot_tools/fetch v8 \ 
 && git -C v8 checkout branch-heads/10.8 \
 && depot_tools/gclient sync \
 && build/install-build-deps.sh --no-syms --no-chromeos-fonts --no-arm --no-nacl --no-backwards-compatible \
 && tools/dev/v8gen.py x64.release -- target_os=\"linux\" target_cpu=\"x64\" v8_target_cpu=\"x64\" \
	v8_use_external_startup_data=false \
	v8_enable_future=true \
	is_official_build=false \
	is_component_build=false \
	is_cfi=false \
	is_asan=false \
	is_clang=false \
	use_custom_libcxx=false \
	use_custom_libcxx_for_host=false \
	use_sysroot=false \
	use_gold=false \
	is_debug=false \
	treat_warnings_as_errors=false \
	v8_enable_i18n_support=false \
	symbol_level=0 \
	v8_static_library=true \
	v8_monolithic=true \
	proprietary_codecs=false \
	toolkit_views=false \
	use_aura=false \
	use_dbus=false \
	use_gio=false \
	use_glib=false \
	use_ozone=false \
	use_udev=false \
	clang_use_chrome_plugins=false \
	v8_deprecation_warnings=false \
	v8_enable_gdbjit=false \
	v8_imminent_deprecation_warnings=false \
	v8_enable_pointer_compression=true \
	v8_scriptormodule_legacy_lifetime=true \
	v8_enable_sandbox=false
# EOF

# Commit it under its NAME with the Tag: latest as Image
# docker commit $(docker ps -l --format {{.ID}}) $(docker ps -l --format {{.NAME}}):latest
# Output: sysroot-bullseye-x86_64:latest

# reuse above mentioned Image
# cat <<'EOF' | docker run -i --name v8-bullseye-x86_64 $(docker ps -l --format {{.NAME}}):latest
RUN /depot_tools/ninja v8_monolith -C out.gn/x64.release/ -j $(getconf _NPROCESSORS_ONLN)
# EOF

# Commit it under its NAME with the Tag: latest as Image
# docker commit $(docker ps -l --format {{.ID}}) $(docker ps -l --format {{.NAME}}):latest
# Output: v8-bullseye-x86_64:latest === This Dockerfiles Result

# docker save v8-bullseye-x86_64:latest | gzip > v8-bullseye-x86_64-latest.tar.gz
# above created tar includes 2 seperated tar files for the images one for sysroot one for build result.
# 8f5848ef193c85cc74abe276b8be2d88a94eb88523a69b30ddbe681f32ff98a6 SHA_SUM_CREATION`,
  }
} } }];
