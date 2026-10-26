# merge-index sole usage words

Git 2.25 checks argc < 3 before its handwritten ordered -o/-q/program/path loop; newer source also handles sole usage words before arity. The selected executable retains its real usage exit code and output. No parse-options parser is introduced.

Canonical -h and --help-all shapes use sole-word exits and exact-one-word checks. A distinct sole-help key avoids the generic help bypass. The final rules retain a minimum of one word and permit a single tagged operand only when it equals one of the two fixed usage words. Other one-word calls remain rejected, and ordinary two-or-more-word calls retain their existing delegated behavior. Tagged help-looking program names in multiword calls are still native words. No shared parser/type implementation is changed.

Native fixtures contain only stage-zero entries. Clean-index -a succeeds without invoking the deliberately nonexistent merge program; missing-path and help/error cases likewise supply no unmerged entry. Index, tracked bytes, HEAD and root directory entries are compared. Actual merge-program invocation, conflicted-index resolution, payloads and complete platform/configuration grammar remain unverified. All command audits remain partial.
