// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import { Search } from 'lucide-react';

import { FieldHint, Input, Label, Textarea } from '../src/components/Input';

const meta: Meta<typeof Input> = {
  title: 'Primitives/Input',
  component: Input,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = { args: { placeholder: 'Audit team lead…' } };
export const WithIcon: Story = { args: { iconLeft: <Search />, placeholder: 'Search clauses' } };
export const Invalid: Story = {
  args: { 'aria-invalid': true, defaultValue: 'NC-2024-A' },
};
export const Composed: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-1.5">
      <Label htmlFor="scope" required>
        AIMS scope
      </Label>
      <Input id="scope" placeholder="e.g. RAG-based copilot in EU/EEA" />
      <FieldHint>Use the auditee's declared scope statement verbatim.</FieldHint>
    </div>
  ),
};

export const TextareaStory: StoryObj<typeof Textarea> = {
  name: 'Textarea',
  render: () => (
    <Textarea placeholder="Observation notes…" className="w-80" defaultValue="Reviewed AIMS scope documentation; clause 4.3 satisfied." />
  ),
};
