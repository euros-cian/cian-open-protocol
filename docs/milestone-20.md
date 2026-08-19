# Milestone 20 — multiple independent providers

Milestone 20 proves that independently authenticated compute providers can safely compete for work without double-claiming a job or exceeding their signed capacity.

## Matching rules

- Jobs are matched only to a currently available signed commitment.
- The commitment resource class must appear in the redemption's accepted classes.
- The job amount must fit within the commitment's remaining recognised capacity.
- Capacity is reserved in the same claim operation that leases the job.
- PostgreSQL uses row locks with `SKIP LOCKED`, so concurrent providers cannot lease the same job.
- A completion receipt must name the exact resource class of the commitment that won the claim.
- Temporary failure or lease expiry restores reserved capacity before a retry.

## Demonstration

```powershell
npm run demo:multi-provider
```

The demonstration starts two providers with different resource classes, submits compatible jobs, claims concurrently through authenticated HTTP clients, and permanently retires the corresponding To Bach exactly once per completed job.
