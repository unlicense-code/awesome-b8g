/**
 * Creates RootFS be patient when editing this contains special UTF-8 Chars
 * Also do not pritty up that file unless you know what your doing.
 */ 
const KERNEL_SOURCE_URL = `https://kernel.org/pub/linux/kernel/v5.x/linux-5.19.3.tar.xz`;
const FIRMWARE_TYPE=`bios` // uefi both
const OVERLAY_TYPE=`mount` // folder sparse
const CFLAGS=`-Os -s -fno-stack-protector -fomit-frame-pointer -U_FORTIFY_SOURCE`

const dirLayout = ["dev","etc",["etc/msg/01_prepare.sh","etc/msg/02_overlay.sh", "etc/msg/03_init.sh","etc/msg/04_bootscript.sh"]]

const inittab = `::sysinit:/etc/04_bootscript.sh
::restart:/sbin/init
::shutdown:echo -e "\nSyncing all file buffers."
::shutdown:sync
::shutdown:echo "Unmounting all filesystems."
::shutdown:umount -a -r
::shutdown:echo -e "\n  \\e[1mCome back soon. :)\\e[0m\n"
::shutdown:sleep 1
::ctrlaltdel:/sbin/reboot
::once:cat /etc/motd
::respawn:/bin/cttyhack /bin/sh
tty2::once:cat /etc/motd
tty2::respawn:/bin/sh
tty3::once:cat /etc/motd
tty3::respawn:/bin/sh
tty4::once:cat /etc/motd
tty4::respawn:/bin/sh`

const msg = {
 "03_init_01.txt": `[1m
  Press empty key (TAB, SPACE, ENTER) or wait 5 seconds to continue with the
  system initialization process. Press any other key for PID 1 rescue shell
  outside of the initramfs area.
[0m
`,
  "03_init_02.txt": `[1m  This is PID 1 rescue shell outside of the initramfs area. Execute the
  following in order to continue with the system initialization:
[1m[32m
  exec /sbin/init
[0m
`,
  "motd": `[0m
  ###################################
  #                                 #
  # [1mScratch [32mLinux [31mLive[0m  #
  #                                 #
  ###################################
[0m`
}

// hostd does not refer to HostD or something like that also not to the ESX hostd It refers to HoSTD Hardware operation STandarD


// boot/bios/UEFI/
const biosUEFI = {
  "entries/x86_64.conf": `title Linux from Scratch Live
version x86_64
efi /x86_64/kernel.xz
options initrd=/x86_64/rootfs.xz`,
}

//boot/bios/EFI/startup.nsh
const biosEFI = `echo -off
echo starting.....
\boot\kernel.xz initrd=\boot\rootfs.xz`;
// boot/bios/syslinux/syslinux.cfg
const biosSyslinuxCfg =`SERIAL 0
PROMPT 1
TIMEOUT 50
DEFAULT vga

SAY
SAY   ##################################################################
SAY   #                                                                #
SAY   #  Press <ENTER> to boot or wait 5 seconds.                      #
SAY   #                                                                #
SAY   #  Press <TAB> to view available boot entries or enter Syslinux  #
SAY   #  commands directly.                                            #
SAY   #                                                                #
SAY   ##################################################################
SAY

LABEL vga
  LINUX  /boot/kernel.xz
  APPEND vga=ask
  INITRD /boot/rootfs.xz

LABEL vga_nomodeset
  LINUX  /boot/kernel.xz
  APPEND vga=ask nomodeset
  INITRD /boot/rootfs.xz

LABEL console
  LINUX  /boot/kernel.xz
  APPEND console=tty0 console=ttyS0
  INITRD /boot/rootfs.xz`;

const init = `#!/bin/sh

echo -e "\\e[1mScratch \\e[32mLinux \\e[31mLive\\e[0m (/init)"
/etc/01_prepare.sh
cat /etc/msg/init_01.txt
read -t 5 -n1 -s key

if [ ! "$key" = "" ] ; then
  cat /etc/msg/init_02.txt
  export PID1_SHELL=true
  # Interactive shell with controlling tty as PID 1.
  exec setsid cttyhack sh
fi

# Entering Ring 3
# etc/03_init.sh' as the new init process.
exec /etc/02_overlay.sh

## Debug
echo "(/init) - you can never see this unless there is a serious bug."
read -n1 -s`;

const rescueBootMsg = {}


const overlay_common = `#!/bin/sh

set -e

# Common code used by all bundles. Should be included at the
# top of every *.sh file of each bundle.

export SRC_DIR=`realpath --no-symlinks $PWD`
export MAIN_SRC_DIR=`realpath --no-symlinks $SRC_DIR/../../../`
export WORK_DIR=$MAIN_SRC_DIR/work
export SOURCE_DIR=$MAIN_SRC_DIR/source
export OVERLAY_WORK_DIR=$WORK_DIR/overlay
export OVERLAY_SOURCE_DIR=$SOURCE_DIR/overlay
export OVERLAY_ROOTFS=$WORK_DIR/overlay_rootfs
export BUNDLE_NAME=`basename $SRC_DIR`
export DEST_DIR=$WORK_DIR/overlay/$BUNDLE_NAME/${BUNDLE_NAME}_installed
export CONFIG=$MAIN_SRC_DIR/.config
export SYSROOT=$WORK_DIR/sysroot

# This function reads property from the main '.config' file.
# If there is local '.config' file in the current directory
# the property value is overridden with the value found in
# the local '.config' file, if the property is present there.
#
# Using () instead of {} for the function body is a POSIX
# compliant way to execute subshell and as consequence all
# variables in the function will become effectively in local
# scope. Note that the 'local' keyword is supported by most
# shells but it is not POSIX compliant.
read_property() (
  # The property we are looking for.
  prop_name=$1

  # The value of the property set initially to empty string.
  prop_value=

  if [ ! "$prop_name" = "" ] ; then
    # Search in the main '.config' file.
    prop_value="`grep -i ^${prop_name}= $CONFIG | cut -f2- -d'=' | xargs`"

    if [ -f $SRC_DIR/.config ] ; then
      # Search in the local '.config' file.
      prop_value_local="`grep -i ^${prop_name}= $SRC_DIR/.config | cut -f2- -d'=' | xargs`"

      if [ ! "$prop_value_local" = "" ] ; then
        # Override the original value with the local value.
        prop_value="$prop_value_local"
      fi
    fi
  fi

  echo "$prop_value"
)

# Read commonly used configuration properties.
export JOB_FACTOR="`read_property JOB_FACTOR`"
export CFLAGS="`read_property CFLAGS`"
export NUM_CORES="$(grep ^processor /proc/cpuinfo | wc -l)"

# Calculate the number of make "jobs"
export NUM_JOBS="$((NUM_CORES * JOB_FACTOR))"

# Ideally we would export MAKE at this point with -j etc to allow programs to just run $(MAKE) and not worry about extra flags that need to be passed
# export MAKE="${MAKE-make} -j $NUM_JOBS"

download_source() (
  url=$1  # Download from this URL.
  file=$2 # Save the resource in this file.

  local=`read_property USE_LOCAL_SOURCE`

  if [ "$local" = "true" -a ! -f $file  ] ; then
    echo "Source file '$file' is missing and will be downloaded."
    local=false
  fi

  if [ ! "$local" = "true" ] ; then
    echo "Downloading overlay source file from '$url'."
    echo "Saving overlay source file in '$file'".
    wget -O $file -c $url
  else
    echo "Using local overlay source file '$file'."
  fi
)

extract_source() (
  file=$1
  name=$2

  # Delete folder with previously extracted source.
  echo "Removing overlay work area for '$name'. This may take a while."
  rm -rf $OVERLAY_WORK_DIR/$name
  mkdir -p $OVERLAY_WORK_DIR/$name

  # Extract source to folder 'work/overlay/$source'.
  tar -xvf $file -C $OVERLAY_WORK_DIR/$name
)

make_target() (
  make -j $NUM_JOBS "$@"
)

make_clean() (
  target=$1

  if [ "$target" = "" ] ; then
    target=clean
  fi

  if [ -f Makefile ] ; then
    echo "Preparing '$BUNDLE_NAME' work area. This may take a while."
    make_target $target
  else
    echo "The clean phase for '$BUNDLE_NAME' has been skipped."
  fi
)

reduce_size() (
  while [ ! "$1" = "" ] ; do
    if [ -d $1 ] ; then
      for file in $1/* ; do
        reduce_size $file
      done
    elif [ -f $1 ] ; then
      set +e
      strip -g $1 2>/dev/null
      set -e
    fi
    
    shift
  done
)

install_to_overlay() (
  # With '--remove-destination' all possibly existing soft links in
  # $OVERLAY_ROOTFS will be overwritten correctly.

  if [ "$#" = "2" ] ; then
    cp -r --remove-destination \
      $DEST_DIR/$1 \
      $OVERLAY_ROOTFS/$2
  elif [ "$#" = "1" ] ; then
    cp -r --remove-destination \
      $DEST_DIR/$1 \
      $OVERLAY_ROOTFS
  elif [ "$#" = "0" ] ; then
    cp -r --remove-destination \
      $DEST_DIR/* \
      $OVERLAY_ROOTFS
  fi
)
`
  
const overlayBuild = `#!/bin/sh

set -e

SRC_DIR=$(pwd)

# Find the main source directory
cd ..
MAIN_SRC_DIR=$(pwd)
cd $SRC_DIR

if [ "$1" = "--skip-clean" ] ; then
  SKIP_CLEAN=true
  shift
fi

if [ "$1" = "" ] ; then
  # Read the 'OVERLAY_BUNDLES' property from '.config'
  OVERLAY_BUNDLES="$(grep -i ^OVERLAY_BUNDLES $MAIN_SRC_DIR/.config | cut -f2 -d'=')"
else
  OVERLAY_BUNDLES=$1
fi

if [ "$OVERLAY_BUNDLES" = "" ] ; then
  echo "There are no overlay bundles to build."
  exit 1
fi

if [ ! "$SKIP_CLEAN" = "true" ] ; then
  ./overlay_clean.sh
fi

if [ "$OVERLAY_BUNDLES" = "all" ] ; then
  BUNDLES_LIST=`ls $SRC_DIR/bundles`
else
  BUNDLES_LIST="$(echo $OVERLAY_BUNDLES | tr ',' ' ')"
fi

for BUNDLE in $BUNDLES_LIST
do
  BUNDLE_DIR=$SRC_DIR/bundles/$BUNDLE

  if [ ! -d $BUNDLE_DIR ] ; then
      echo "Error - cannot find overlay bundle directory '$BUNDLE_DIR'."
      exit 1
  fi

  # Deal with dependencies BEGIN
  if [ -f $BUNDLE_DIR/bundle_deps ] ; then
    echo "Overlay bundle '$BUNDLE' depends on the following overlay bundles:"
    cat $BUNDLE_DIR/bundle_deps

    while read line; do
      # Trim all white spaces in bundle name
      BUNDLE_DEP=`echo $line | awk '{print $1}'`

      case "$BUNDLE_DEP" in
      \#*)
        # This is comment line.
        continue
        ;;
      esac

      if [ "$BUNDLE_DEP" = "" ] ; then
        continue
      elif [ -d $MAIN_SRC_DIR/work/overlay/$BUNDLE_DEP ] ; then
        echo "Overlay bundle '$BUNDLE_DEP' has already been prepared."
      else
        echo "Preparing overlay bundle '$BUNDLE_DEP'."
        cd $SRC_DIR
        ./overlay_build.sh --skip-clean $BUNDLE_DEP
        echo "Overlay bundle '$BUNDLE_DEP' has been prepared."
      fi
    done < $BUNDLE_DIR/bundle_deps
  fi
  # Deal with dependencies END

  BUNDLE_SCRIPT=$BUNDLE_DIR/bundle.sh

  if [ ! -f $BUNDLE_SCRIPT ] ; then
    echo "Error - cannot find overlay bundle script file '$BUNDLE_SCRIPT'."
    exit 1
  fi

  cd $BUNDLE_DIR

  echo "Building overlay bundle '$BUNDLE'."
  $BUNDLE_SCRIPT

  cd $SRC_DIR
done

cd $SRC_DIR`;

const overlayClean = `#!/bin/sh

set -e

SRC_DIR=$(pwd)

echo "Cleaning up the overlay work area. This may take a while."
rm -rf ../work/overlay
rm -rf ../work/overlay_rootfs

# -p stops errors if the directory already exists.
mkdir -p ../work/overlay
mkdir -p ../work/overlay_rootfs
mkdir -p ../source/overlay

echo "Ready to continue with the overlay software."

cd $SRC_DIR`;
