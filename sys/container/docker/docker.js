// As a convention we add directory import support always referencing the corrsoponding js file
// in this case the resolved result is /sys/container/docker/docker.js
// in case of binary data you should simply return obj describing how to handle the binary data like readAsText, readAsBlob or .text .blob
// its also a convention to return iterables directly or functions that return them. It is then up to the importer to choose the right method.
// for the imported object mostly the d.ts files give type hints..
// import('awesome:/sys/container/docker/');
