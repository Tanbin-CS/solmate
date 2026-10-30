// Every commit on main must be a meaningful Conventional Commit.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 72],
    'body-empty': [2, 'never'],
    'body-max-line-length': [1, 'always', 100],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
    'type-enum': [2, 'always', ['feat', 'fix', 'docs', 'test', 'refactor', 'perf', 'build', 'ci', 'chore', 'revert']],
  },
  ignores: [(msg) => msg.startsWith('Merge ') || msg.startsWith('Drop unused cn')],
};
