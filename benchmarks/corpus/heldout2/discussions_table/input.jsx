import { forwardRef } from 'react';
import { bump } from '../../shared/counter.js';

// utils/cn.ts, without tailwind-merge.
const cn = (...args) => args.filter(Boolean).join(' ');

// components/ui/link, as a plain anchor.
const Link = ({ to, ...props }) => <a href={to} {...props} />;

// utils/format.ts. The counted call feeds the result, so a compiler that skips it skips the count.
function formatDate(value) {
  bump('formatDate');
  return new Date(value).toISOString().slice(0, 10);
}

// components/ui/table/pagination.tsx. Icons are replaced by text.
const Pagination = ({ className, ...props }) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
);
Pagination.displayName = 'Pagination';

const PaginationContent = forwardRef(({ className, ...props }, ref) => (
  <ul ref={ref} className={cn('flex flex-row items-center gap-1', className)} {...props} />
));
PaginationContent.displayName = 'PaginationContent';

const PaginationItem = forwardRef(({ className, ...props }, ref) => (
  <li ref={ref} className={cn('', className)} {...props} />
));
PaginationItem.displayName = 'PaginationItem';

const PaginationLink = ({ className, isActive, size = 'icon', children, href, ...props }) => (
  <Link
    to={href}
    aria-current={isActive ? 'page' : undefined}
    className={cn(isActive ? 'outline' : 'ghost', size, className)}
    {...props}
  >
    {children}
  </Link>
);

const PaginationPrevious = ({ className, ...props }) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="default"
    className={cn('gap-1 pl-2.5', className)}
    {...props}
  >
    <span>&lsaquo;</span>
    <span>Previous</span>
  </PaginationLink>
);

const PaginationNext = ({ className, ...props }) => (
  <PaginationLink
    aria-label="Go to next page"
    size="default"
    className={cn('gap-1 pr-2.5', className)}
    {...props}
  >
    <span>Next</span>
    <span>&rsaquo;</span>
  </PaginationLink>
);

const PaginationEllipsis = ({ className, ...props }) => (
  <span aria-hidden className={cn('flex h-9 w-9 items-center justify-center', className)} {...props}>
    <span>&hellip;</span>
    <span className="sr-only">More pages</span>
  </span>
);

const TablePagination = ({ totalPages, currentPage, rootUrl }) => {
  const createHref = (page) => `${rootUrl}?page=${page}`;

  return (
    <Pagination className="justify-end py-8">
      <PaginationContent>
        {currentPage > 1 && (
          <PaginationItem>
            <PaginationPrevious href={createHref(currentPage - 1)} />
          </PaginationItem>
        )}
        {currentPage > 2 && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}
        {currentPage > 1 && (
          <PaginationItem>
            <PaginationLink href={createHref(currentPage - 1)}>{currentPage - 1}</PaginationLink>
          </PaginationItem>
        )}
        <PaginationItem className="rounded-sm bg-gray-200">
          <PaginationLink href={createHref(currentPage)}>{currentPage}</PaginationLink>
        </PaginationItem>
        {totalPages > currentPage && (
          <PaginationItem>
            <PaginationLink href={createHref(currentPage + 1)}>{currentPage + 1}</PaginationLink>
          </PaginationItem>
        )}
        {totalPages > currentPage + 1 && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}
        {currentPage < totalPages && (
          <PaginationItem>
            <PaginationNext href={createHref(totalPages)} />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
};

// components/ui/table/table.tsx, without the footer and caption parts that nothing uses.
const TableElement = forwardRef(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
  </div>
));
TableElement.displayName = 'Table';

const TableHeader = forwardRef(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = forwardRef(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

const TableRow = forwardRef(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn('border-b transition-colors hover:bg-muted/50', className)} {...props} />
));
TableRow.displayName = 'TableRow';

const TableHead = forwardRef(({ className, ...props }, ref) => (
  <th ref={ref} className={cn('h-10 px-2 text-left align-middle font-medium', className)} {...props} />
));
TableHead.displayName = 'TableHead';

const TableCell = forwardRef(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('p-2 align-middle', className)} {...props} />
));
TableCell.displayName = 'TableCell';

const Table = ({ data, columns, pagination }) => {
  if (!data?.length) {
    return (
      <div className="flex h-80 flex-col items-center justify-center bg-white text-gray-500">
        <h4>No Entries Found</h4>
      </div>
    );
  }
  return (
    <>
      <TableElement>
        <TableHeader>
          <TableRow>
            {columns.map((column, index) => (
              <TableHead key={column.title + index}>{column.title}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((entry, entryIndex) => (
            <TableRow key={entry?.id || entryIndex}>
              {columns.map(({ Cell, field, title }, columnIndex) => (
                <TableCell key={title + columnIndex}>
                  {Cell ? <Cell entry={entry} /> : `${entry[field]}`}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </TableElement>
      {pagination && <TablePagination {...pagination} />}
    </>
  );
};

// features/discussions/components/delete-discussion.tsx, reduced to a counted child.
function DeleteDiscussion({ id }) {
  bump('Row');
  return <button type="button">Delete {id}</button>;
}

// features/discussions/components/discussions-list.tsx. The query hooks are replaced by props.
export const DiscussionsList = ({ discussions, meta, onDiscussionPrefetch }) => {
  if (!discussions) return null;

  return (
    <Table
      data={discussions}
      columns={[
        {
          title: 'Title',
          field: 'title',
        },
        {
          title: 'Created At',
          field: 'createdAt',
          Cell({ entry: { createdAt } }) {
            return <span>{formatDate(createdAt)}</span>;
          },
        },
        {
          title: '',
          field: 'id',
          Cell({ entry: { id } }) {
            return (
              <Link
                onMouseEnter={() => {
                  onDiscussionPrefetch?.(id);
                }}
                to={`/app/discussions/${id}`}
              >
                View
              </Link>
            );
          },
        },
        {
          title: '',
          field: 'id',
          Cell({ entry: { id } }) {
            return <DeleteDiscussion id={id} />;
          },
        },
      ]}
      pagination={
        meta && {
          totalPages: meta.totalPages,
          currentPage: meta.page,
          rootUrl: '',
        }
      }
    />
  );
};
