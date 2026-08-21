# Release gate

No Game Center branch merges solely because the code exists. Required gates: database migration succeeds, Vercel preview is Ready, existing core routes still build, and visible workflows are tested. Production deployment is then watched until Ready.
