import test from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { isAnsibleRepo } from "../src/git.js";
import { extractPlaybook, extractRole } from "../src/extractor.js";
import { getOrBuildCache } from "../src/cache.js";
import { formatCacheForPrompt } from "../src/formatter.js";
test("isAnsibleRepo correctly identifies Ansible repositories", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ansible-test-"));
    try {
        assert.equal(isAnsibleRepo(tempDir), false);
        // Add ansible.cfg
        fs.writeFileSync(path.join(tempDir, "ansible.cfg"), "[defaults]\n");
        assert.equal(isAnsibleRepo(tempDir), true);
    }
    finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
test("extractPlaybook parses plays, hosts, roles, and tasks", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pb-test-"));
    try {
        const pbPath = path.join(tempDir, "test-playbook.yaml");
        fs.writeFileSync(pbPath, `---
- name: Test Play
  hosts: all
  roles:
    - common
    - role: webserver
  tasks:
    - name: Ping host
      ansible.builtin.ping:
    - name: Create file
      file:
        path: /tmp/test
`);
        const summary = extractPlaybook(pbPath, "playbooks/test-playbook.yaml");
        assert.ok(summary);
        assert.equal(summary.plays.length, 1);
        assert.equal(summary.plays[0].name, "Test Play");
        assert.equal(summary.plays[0].hosts, "all");
        assert.deepEqual(summary.plays[0].roles, ["common", "webserver"]);
        assert.deepEqual(summary.plays[0].tasks, ["Ping host", "Create file"]);
    }
    finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
test("extractRole parses tasks, handlers, templates, and vars keys without leaking secrets", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "role-test-"));
    try {
        const roleDir = path.join(tempDir, "myrole");
        fs.mkdirSync(path.join(roleDir, "tasks"), { recursive: true });
        fs.mkdirSync(path.join(roleDir, "handlers"), { recursive: true });
        fs.mkdirSync(path.join(roleDir, "templates"), { recursive: true });
        fs.mkdirSync(path.join(roleDir, "defaults"), { recursive: true });
        fs.writeFileSync(path.join(roleDir, "tasks", "main.yaml"), `---
- name: Install nginx
  ansible.builtin.package:
    name: nginx
- name: Setup config
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
  notify: Restart Nginx
`);
        fs.writeFileSync(path.join(roleDir, "handlers", "main.yaml"), `---
- name: Restart Nginx
  ansible.builtin.systemd:
    name: nginx
    state: restarted
`);
        fs.writeFileSync(path.join(roleDir, "templates", "nginx.conf.j2"), "server { listen 80; }");
        fs.writeFileSync(path.join(roleDir, "defaults", "main.yaml"), `---
secret_token: "super-secret-password-123"
http_port: 8080
`);
        const summary = extractRole(roleDir, "myrole");
        assert.equal(summary.name, "myrole");
        assert.equal(summary.tasks.length, 2);
        assert.equal(summary.tasks[0].name, "Install nginx");
        assert.equal(summary.tasks[0].module, "ansible.builtin.package");
        assert.deepEqual(summary.handlers, ["Restart Nginx"]);
        assert.deepEqual(summary.templates, ["nginx.conf.j2"]);
        assert.deepEqual(summary.vars_keys, ["http_port", "secret_token"]);
        // Ensure secret value is NOT leaked into vars_keys
        const formatted = JSON.stringify(summary);
        assert.ok(!formatted.includes("super-secret-password-123"));
    }
    finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
test("getOrBuildCache caches and detects cache hits vs misses", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cache-test-"));
    try {
        fs.writeFileSync(path.join(tempDir, "ansible.cfg"), "[defaults]\n");
        fs.mkdirSync(path.join(tempDir, "playbooks"), { recursive: true });
        const firstRun = getOrBuildCache(tempDir);
        assert.equal(firstRun.source, "miss");
        // Second run should be hit
        const secondRun = getOrBuildCache(tempDir);
        assert.equal(secondRun.source, "hit");
        // Formatter outputs markdown prompt
        const promptText = formatCacheForPrompt(secondRun.cache);
        assert.ok(promptText.includes("# Ansible Repository Index"));
    }
    finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
test("Scan on real repo /Volumes/work/projects/ansible succeeds and extracts roles/playbooks", () => {
    const ansibleRepo = "/Volumes/work/projects/ansible";
    if (fs.existsSync(path.join(ansibleRepo, "ansible.cfg"))) {
        assert.equal(isAnsibleRepo(ansibleRepo), true);
        const result = getOrBuildCache(ansibleRepo, true); // force rebuild to test scan
        assert.ok(Object.keys(result.cache.roles).length > 5);
        assert.ok(Object.keys(result.cache.playbooks).length > 5);
        assert.ok(result.cache.inventory.groups.length > 0);
        const promptText = formatCacheForPrompt(result.cache);
        assert.ok(promptText.includes("## Playbooks"));
        assert.ok(promptText.includes("## Roles"));
        assert.ok(promptText.includes("stepca"));
    }
});
//# sourceMappingURL=extractor.test.js.map