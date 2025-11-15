/**
 * Unit tests for Notion markdown parser
 *
 * Tests the parser functions that extract structured data from markdown files.
 * These tests cover common cases and edge cases to ensure robust parsing.
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const fs = require('fs');
const path = require('path');
const { parseProjectPlan, parseProjectTasks, parseProject } = require('../../scripts/notion-parse-markdown');

// Temporary test directory
const TEST_DIR = path.join(__dirname, '../../.test-notion-parser');

describe('Notion Markdown Parser', () => {
  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Cleanup test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('parseProjectPlan()', () => {
    it('should parse basic project metadata', () => {
      const planPath = path.join(TEST_DIR, 'test-plan.md');
      fs.writeFileSync(planPath, `
# Test Project

**Status:** Active
**Phase:** Phase 1
**Components:** Backend, Frontend, Database
**Start Date:** 2025-11-15
**Target Date:** 2025-12-01
      `.trim());

      const result = parseProjectPlan(planPath);

      expect(result).toEqual({
        name: 'Test Project',
        status: 'Active',
        phase: 'Phase 1',
        components: ['Backend', 'Frontend', 'Database'],
        dates: {
          startDate: '2025-11-15',
          targetDate: '2025-12-01'
        }
      });
    });

    it('should handle missing optional fields gracefully', () => {
      const planPath = path.join(TEST_DIR, 'minimal-plan.md');
      fs.writeFileSync(planPath, `
# Minimal Project

**Status:** Planning
      `.trim());

      const result = parseProjectPlan(planPath);

      expect(result.name).toBe('Minimal Project');
      expect(result.status).toBe('Planning');
      expect(result.phase).toBe('Unknown');
      expect(result.components).toEqual([]);
    });

    it('should return null for empty file', () => {
      const planPath = path.join(TEST_DIR, 'empty-plan.md');
      fs.writeFileSync(planPath, '');

      const result = parseProjectPlan(planPath);

      expect(result).toBeNull();
    });

    it('should handle file not found gracefully', () => {
      const planPath = path.join(TEST_DIR, 'nonexistent.md');

      const result = parseProjectPlan(planPath);

      expect(result).toBeNull();
    });
  });

  describe('parseProjectTasks()', () => {
    it('should parse Todo tasks', () => {
      const tasksPath = path.join(TEST_DIR, 'test-tasks.md');
      fs.writeFileSync(tasksPath, `
## Phase 1 Tasks

- [ ] Task 1
- [ ] Task 2 [P0]
- [ ] Task 3 [3h]
      `.trim());

      const result = parseProjectTasks(tasksPath);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        name: 'Task 1',
        status: 'Todo',
        priority: null,
        estimatedHours: null
      });
      expect(result[1].priority).toBe('P0');
      expect(result[2].estimatedHours).toBe(3);
    });

    it('should parse Done tasks', () => {
      const tasksPath = path.join(TEST_DIR, 'done-tasks.md');
      fs.writeFileSync(tasksPath, `
- [x] Completed task 1
- [x] Completed task 2
      `.trim());

      const result = parseProjectTasks(tasksPath);

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('Done');
      expect(result[1].status).toBe('Done');
    });

    it('should parse In Progress tasks', () => {
      const tasksPath = path.join(TEST_DIR, 'progress-tasks.md');
      fs.writeFileSync(tasksPath, `
- [~] In progress task
      `.trim());

      const result = parseProjectTasks(tasksPath);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('In Progress');
    });

    it('should handle malformed checkboxes', () => {
      const tasksPath = path.join(TEST_DIR, 'malformed-tasks.md');
      fs.writeFileSync(tasksPath, `
- [ ] Valid task
- [X] Uppercase X task
- [] Missing space task
- [ Invalid checkbox
      `.trim());

      const result = parseProjectTasks(tasksPath);

      // Should only parse valid checkboxes
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].name).toBe('Valid task');
    });

    it('should return empty array for file with no tasks', () => {
      const tasksPath = path.join(TEST_DIR, 'no-tasks.md');
      fs.writeFileSync(tasksPath, `
## Project Overview

This project has no tasks yet.
      `.trim());

      const result = parseProjectTasks(tasksPath);

      expect(result).toEqual([]);
    });

    it('should handle priority parsing', () => {
      const tasksPath = path.join(TEST_DIR, 'priority-tasks.md');
      fs.writeFileSync(tasksPath, `
- [ ] Task [P0]
- [ ] Task [P1]
- [ ] Task [P2]
- [ ] Task [P3]
      `.trim());

      const result = parseProjectTasks(tasksPath);

      expect(result[0].priority).toBe('P0');
      expect(result[1].priority).toBe('P1');
      expect(result[2].priority).toBe('P2');
      expect(result[3].priority).toBe('P3');
    });

    it('should handle estimated hours parsing', () => {
      const tasksPath = path.join(TEST_DIR, 'hours-tasks.md');
      fs.writeFileSync(tasksPath, `
- [ ] Task [1h]
- [ ] Task [2.5h]
- [ ] Task [10h]
      `.trim());

      const result = parseProjectTasks(tasksPath);

      expect(result[0].estimatedHours).toBe(1);
      expect(result[1].estimatedHours).toBe(2.5);
      expect(result[2].estimatedHours).toBe(10);
    });
  });

  describe('parseProject()', () => {
    it('should parse complete project structure', () => {
      const projectDir = path.join(TEST_DIR, 'full-project');
      fs.mkdirSync(projectDir, { recursive: true });

      // Create all 3 required files
      fs.writeFileSync(path.join(projectDir, 'full-project-plan.md'), `
# Full Project

**Status:** Active
**Phase:** Phase 1
      `.trim());

      fs.writeFileSync(path.join(projectDir, 'full-project-context.md'), `
## Summary

This is a test project for unit testing.

## Key Decisions

- Use Jest for testing
- Keep tests simple
      `.trim());

      fs.writeFileSync(path.join(projectDir, 'full-project-tasks.md'), `
- [ ] Task 1
- [x] Task 2
      `.trim());

      const result = parseProject(projectDir);

      expect(result).not.toBeNull();
      expect(result.name).toBe('Full Project');
      expect(result.status).toBe('Active');
      expect(result.tasks).toHaveLength(2);
      expect(result.context).toContain('This is a test project');
    });

    it('should return null if plan file missing', () => {
      const projectDir = path.join(TEST_DIR, 'no-plan');
      fs.mkdirSync(projectDir, { recursive: true });

      const result = parseProject(projectDir);

      expect(result).toBeNull();
    });

    it('should handle missing context file gracefully', () => {
      const projectDir = path.join(TEST_DIR, 'no-context');
      fs.mkdirSync(projectDir, { recursive: true });

      fs.writeFileSync(path.join(projectDir, 'no-context-plan.md'), `
# Project Without Context

**Status:** Testing
      `.trim());

      fs.writeFileSync(path.join(projectDir, 'no-context-tasks.md'), `
- [ ] Test task
      `.trim());

      const result = parseProject(projectDir);

      expect(result).not.toBeNull();
      expect(result.name).toBe('Project Without Context');
      expect(result.context).toBe('');
      expect(result.tasks).toHaveLength(1);
    });

    it('should handle missing tasks file gracefully', () => {
      const projectDir = path.join(TEST_DIR, 'no-tasks');
      fs.mkdirSync(projectDir, { recursive: true });

      fs.writeFileSync(path.join(projectDir, 'no-tasks-plan.md'), `
# Project Without Tasks

**Status:** Planning
      `.trim());

      const result = parseProject(projectDir);

      expect(result).not.toBeNull();
      expect(result.name).toBe('Project Without Tasks');
      expect(result.tasks).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long project names', () => {
      const planPath = path.join(TEST_DIR, 'long-name-plan.md');
      const longName = 'A'.repeat(200);
      fs.writeFileSync(planPath, `# ${longName}\n\n**Status:** Active`);

      const result = parseProjectPlan(planPath);

      expect(result.name).toBe(longName);
    });

    it('should handle special characters in task names', () => {
      const tasksPath = path.join(TEST_DIR, 'special-chars-tasks.md');
      fs.writeFileSync(tasksPath, `
- [ ] Task with "quotes"
- [ ] Task with <html>
- [ ] Task with &amp; entity
      `.trim());

      const result = parseProjectTasks(tasksPath);

      expect(result).toHaveLength(3);
      expect(result[0].name).toContain('"quotes"');
      expect(result[1].name).toContain('<html>');
    });

    it('should handle Unicode characters', () => {
      const tasksPath = path.join(TEST_DIR, 'unicode-tasks.md');
      fs.writeFileSync(tasksPath, `
- [ ] Task with emojis 🚀 ✅
- [ ] Задача на русском
- [ ] 中文任务
      `.trim());

      const result = parseProjectTasks(tasksPath);

      expect(result).toHaveLength(3);
      expect(result[0].name).toContain('🚀');
      expect(result[1].name).toContain('русском');
      expect(result[2].name).toContain('中文');
    });

    it('should handle large files (performance test)', () => {
      const tasksPath = path.join(TEST_DIR, 'large-tasks.md');

      // Generate 1000 tasks
      const lines = [];
      for (let i = 0; i < 1000; i++) {
        lines.push(`- [ ] Task ${i}`);
      }
      fs.writeFileSync(tasksPath, lines.join('\n'));

      const startTime = Date.now();
      const result = parseProjectTasks(tasksPath);
      const duration = Date.now() - startTime;

      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should parse in <1 second
    });
  });
});
