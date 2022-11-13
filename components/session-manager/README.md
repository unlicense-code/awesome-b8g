# A Base Session Manager Component 
similar to Passport for NodeJS allows you to implement auth strategies.

## Basic Auth Flow
Server Sends Access Token if user is valid the access token returns refresh and session token then refresh token needs to get used in a loop. 
as the access token is one time and the session token and refresh token need to get saved. If session or refresh is not valid 
you need to start from access again.

```js
KEY::TOKEN_SESSION::REFRESH_TOKEN
KEY::TOKEN_ACCESS=KEY::TOKEN_SESSION::REFRESH_TOKEN // First part can be from 3th party gets exchanged  with the user to request the secund part 
KEY::TOKEN_SESSION::REFRESH_TOKEN // Exchange between both
KEY::TOKEN_SESSION::REFRESH_TOKEN
```

Cert Example
```
KEY::TOKEN_SESSION::REFRESH_TOKEN=CERT
CERT::PGP::USER_PRIVATE // No Exchange with the Authority
CERT::PGP::USER_PUBLIC
CERT::PGP::SYSTEM_PRIVATE // No Exchange with the user. 
CERT::PGP::SYSTEM_PUBLIC
```

exchange 
*_PUBLIC to decrypt
*_PRIVATE to encrypt optional extra secret to allow to encrypt (3th factor)


3th factor generate the 3th factor to authorize the private key dynamical from a 3th KEY (Authencivator Implementaton)
```js
//
```
