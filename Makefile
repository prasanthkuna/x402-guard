.PHONY: setup test failure-lab

setup:
	npm install
	npm run build

test:
	npm run test

failure-lab:
	cd packages/policy && npx vitest run src/authorize.test.ts src/fault-injection.test.ts src/storage.test.ts
