import type { TRecipientLite } from '@documenso/lib/types/recipient';
import { trpc as trpcReact } from '@documenso/trpc/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { Trans } from '@lingui/react/macro';
import { DocumentStatus, EnvelopeType, type TemplateDirectLink } from '@prisma/client';
import { Copy, Download, Edit, FolderIcon, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { EnvelopeDeleteDialog } from '../dialogs/envelope-delete-dialog';
import { EnvelopeDownloadDialog } from '../dialogs/envelope-download-dialog';
import { EnvelopeDuplicateDialog } from '../dialogs/envelope-duplicate-dialog';
import { EnvelopeRenameDialog } from '../dialogs/envelope-rename-dialog';
import { EnvelopesBulkMoveDialog } from '../dialogs/envelopes-bulk-move-dialog';

export type TemplatesTableActionDropdownProps = {
  row: {
    id: number;
    userId: number;
    teamId: number;
    title: string;
    folderId?: string | null;
    envelopeId: string;
    directLink?: Pick<TemplateDirectLink, 'token' | 'enabled'> | null;
    recipients: TRecipientLite[];
  };
  templateRootPath: string;
  teamId: number;
  onDelete?: () => Promise<void> | void;
};

export const TemplatesTableActionDropdown = ({
  row,
  templateRootPath,
  teamId,
  onDelete,
}: TemplatesTableActionDropdownProps) => {
  const trpcUtils = trpcReact.useUtils();
  const navigate = useNavigate();

  const [isRenameDialogOpen, setRenameDialogOpen] = useState(false);
  const [isMoveToFolderDialogOpen, setMoveToFolderDialogOpen] = useState(false);

  const isTeamTemplate = row.teamId === teamId;
  const canMutate = isTeamTemplate;

  const formatPath = `${templateRootPath}/${row.envelopeId}/edit`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger data-testid="template-table-action-btn">
        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-52" align="start" forceMount>
        <DropdownMenuLabel>Action</DropdownMenuLabel>

        <EnvelopeDownloadDialog
          envelopeId={row.envelopeId}
          envelopeStatus={DocumentStatus.DRAFT}
          trigger={
            <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
              <div>
                <Download className="mr-2 h-4 w-4" />
                <Trans>Download</Trans>
              </div>
            </DropdownMenuItem>
          }
        />

        {canMutate && (
          <>
            <DropdownMenuItem asChild>
              <Link to={formatPath}>
                <Edit className="mr-2 h-4 w-4" />
                <Trans>Edit</Trans>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => setRenameDialogOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              <Trans>Rename</Trans>
            </DropdownMenuItem>

            <EnvelopeDuplicateDialog
              envelopeId={row.envelopeId}
              envelopeType={EnvelopeType.TEMPLATE}
              trigger={
                <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                  <div>
                    <Copy className="mr-2 h-4 w-4" />
                    <Trans>Duplicate</Trans>
                  </div>
                </DropdownMenuItem>
              }
            />

            {/*
              RVHOOP FORK ADDITION. "Direct link" and "Bulk Send via CSV" are
              gone. Both turn a template into documents on their way to signers
              — a public signing URL and a spreadsheet of recipients — which is
              exactly the step RVHoop owns, and neither would produce a stay
              RVHoop knows about. Their tRPC procedures are denied for a browser
              session too, so this is the label catching up with the guard.
            */}
            <DropdownMenuItem onClick={() => setMoveToFolderDialogOpen(true)}>
              <FolderIcon className="mr-2 h-4 w-4" />
              <Trans>Move to Folder</Trans>
            </DropdownMenuItem>

            <EnvelopeDeleteDialog
              id={row.envelopeId}
              type={EnvelopeType.TEMPLATE}
              status={DocumentStatus.DRAFT}
              title={row.title}
              canManageDocument={canMutate}
              onDelete={onDelete}
              trigger={
                <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                  <div>
                    <Trash2 className="mr-2 h-4 w-4" />
                    <Trans>Delete</Trans>
                  </div>
                </DropdownMenuItem>
              }
            />
          </>
        )}
      </DropdownMenuContent>

      <EnvelopesBulkMoveDialog
        envelopeIds={[row.envelopeId]}
        envelopeType={EnvelopeType.TEMPLATE}
        open={isMoveToFolderDialogOpen}
        onOpenChange={setMoveToFolderDialogOpen}
        currentFolderId={row.folderId ?? undefined}
        onSuccess={(folderId) => navigate(folderId ? `${templateRootPath}/f/${folderId}` : templateRootPath)}
      />

      <EnvelopeRenameDialog
        id={row.envelopeId}
        initialTitle={row.title}
        open={isRenameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        envelopeType="template"
        onSuccess={async () => {
          await trpcUtils.template.findTemplates.invalidate();
        }}
      />
    </DropdownMenu>
  );
};
