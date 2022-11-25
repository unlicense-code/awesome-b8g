/**
 * Creates RootFS be patient when editing this contains special UTF-8 Chars
 * Also do not pritty up that file unless you know what your doing.
 */ 

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

const rescueBootMsg = {}
