# A Base Session Manager Component 
similar to Passport for NodeJS allows you to implement auth strategies.

## Basic Auth Flow
Server Sends Access Token if user is valid the access token returns refresh and session token then refresh token needs to get used in a loop. 
as the access token is one time and the session token and refresh token need to get saved. If session or refresh is not valid 
you need to start from access again.
