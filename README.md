# (WiP) awesome

## Importent note
This does not build out of the box at present unless you know what your doing. This is Work In Progress designed to get Installed
via a GUI Interface that creates the correct rootfs to build the Platform and or additional Boot Implementations. 

## Start README
A Basic Unlicensed InMemory Storage Implementation can be used as Code Runtime or Scriptable Multi Paradigm Database.
The Main Development happens for historical reasons in https://github.com/lemanschik/src_chromium and https://github.com/lemanschik/src_v8

This implements a run able component based on the src_v8/components/just example runtime offering a middle sized hostd implementation hostd does
not refer to HostD or something like that also not to the ESX hostd It refers to HoSTD Hardware Operation Standard used to implement our core lang.
That gets then translated to Objects which are highly Scriptable as also Distribute able nice snapshot format or other representations.
In This case used to Implement the Interfaces needed to operate on that objects with diffrent interop methods like network clients or posix shells or
filesystems.

## Features
- Offers Scriptable CPP/ECMAScript JIT/AOT Cluster in Memory Data Grid / Object Storage. 
- Can be used with WSL to create Memory Drives in userland for Windows without additional Software. 
- can compile it self!

## Usecases
- Scaleable InMemory Grid.
- Used as backend Host Implementation for unlicensed-code/editor.
- Used as Swiss Army Knife but the Rambo Edition for unlicensed-code/editor.
- filesystem
- version control
- p2p filesharing
- Object Storage
- Serializeable InMemory Representation of Your Apllication
- backend for anything as adapter or storage driver.
- kubernetes operator
- openstack operator
- vfs ceph couchbase oracle db replacement

## How?
The Core is a Application that is able to dynamical link and execute code as also pass arguments to functions and this way implements the concepts of capability based protocols. so a VM. It Is able to run on multiple instances and link them inMemory as also handle locking and message passing in a efficent way.
Is based on most of the fundamentals of V8 as also GraalVM as also the Frida Project. Using the same Composition Pattern that JustJS uses for it's 
builds. In fact justjs was a big Inspiration and showed that all this will work long before we identified that it will be the best when applyed correct.

We learned from a lot of open source projects and abstracted the ovisios and keept the meaning full and that is Condenset into this Project.
As Everything in IT is about Input / Processing / Output and this implements this core fundamentals in a flexible way. That is solid as it is compatible
to any existing Software no matter how it is Implemented so this offers Integrations and Adapters to anything it is awsome!

Overall this trys to algin and clean the dust in the compiler and build tools world.
