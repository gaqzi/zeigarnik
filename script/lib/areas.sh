# The areas from zg-nti, shared by the scripts. Keep in step with the
# area table in .beads/PRIME.md and the .claude/rules/ files.

AREAS="core mod storage evals tooling docs project"

# Areas whose work also loads area:core's decisions.
AREAS_WITH_CORE="mod storage evals"

# Areas whose path rules include testing.md.
AREAS_WITH_TESTS="core mod storage evals"

is_area() {
  case " $AREAS " in *" $1 "*) return 0 ;; esac
  return 1
}
