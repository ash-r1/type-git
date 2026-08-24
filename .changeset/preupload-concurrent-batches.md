---
"type-git": minor
---

Run `lfsExtra.preUpload()` batches concurrently and raise the default batch size

Each `git lfs push --object-id` invocation pays a fixed cost (process spawn,
credential lookup, LFS batch API round-trip) before any bytes are transferred.
Previously the batches ran strictly one after another, so with many objects
this fixed cost accumulated as pure waiting time. Batches now run with a
bounded concurrency (new `concurrency` option, default 4; set 1 for the
previous serial behavior), overlapping the fixed cost with other batches'
transfers.

Two related behaviors are defined precisely:

- The first batch always runs alone; the remaining batches start only after
  it succeeds. A failure that affects every batch the same way (unreachable
  remote, missing local objects) is discovered with a single round-trip.
- Once a batch fails or is aborted, no new batch is started; in-flight
  batches are awaited before returning. The objects of failed and unstarted
  batches are reported in `skippedCount`, so `uploadedCount + skippedCount`
  still equals the number of objects. Previously, every remaining batch was
  still attempted after a failure.

The default `batchSize` is raised from 50 to 200. Git is spawned directly
without a shell, so the binding command-line limit is the Windows
CreateProcess limit of 32,767 characters rather than the 8KB shell limit the
old default assumed; 200 OIDs stay around 40% of the real limit while paying
the per-invocation fixed cost a quarter as often.
