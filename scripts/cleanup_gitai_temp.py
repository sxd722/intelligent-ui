"""Preview/remove stale GitAI Trae decryption DBs in the user's temp folder.

  python scripts/cleanup_gitai_temp.py
  python scripts/cleanup_gitai_temp.py --apply
  python scripts/cleanup_gitai_temp.py --apply --min-age-hours 24

No recursion. Only git-ai-trae-dec-<digits>-<digits>.db is eligible.
Windows deletion requires an exclusive file handle; busy files are skipped.
"""
import argparse
import ctypes
import json
import os
from pathlib import Path
import re
import shutil
import stat
import tempfile
import time

PATTERN = re.compile(r"git-ai-trae-dec-\d+-\d+\.db", re.IGNORECASE)


def candidate(path, root):
    if path.parent != root or not PATTERN.fullmatch(path.name):
        return None
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
        return None  # never follow symlinks/junctions/reparse points
    if path.resolve(strict=True).parent != root:
        return None
    return info


def delete_exclusive(path, root, expected, cutoff):
    if os.name != 'nt':
        raise OSError('Deletion requires Windows exclusive-file-handle support')
    from ctypes import wintypes
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    create = kernel.CreateFileW
    create.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
                       ctypes.c_void_p, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
    create.restype = wintypes.HANDLE
    close = kernel.CloseHandle
    close.argtypes = [wintypes.HANDLE]
    close.restype = wintypes.BOOL
    set_info = kernel.SetFileInformationByHandle
    set_info.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
    set_info.restype = wintypes.BOOL
    # DELETE + FILE_READ_ATTRIBUTES; share=0 excludes active readers/writers.
    handle = create(str(path), 0x10000 | 0x80, 0, None, 3, 0x200000, None)
    if handle == ctypes.c_void_p(-1).value:
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        current = candidate(path, root)
        identity = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns)
        if current is None or identity(current) != identity(expected) or current.st_mtime > cutoff:
            raise OSError('File changed after scan; retained')
        # FILE_DISPOSITION_INFO contains BOOLEAN (one byte), not Win32 BOOL.
        remove = ctypes.c_ubyte(1)
        if not set_info(handle, 4, ctypes.byref(remove), ctypes.sizeof(remove)):
            raise ctypes.WinError(ctypes.get_last_error())
    finally:
        close(handle)


def run(root, apply=False, min_age_hours=1):
    root = Path(root).resolve(strict=True)
    if not root.is_dir() or root == Path(root.anchor):
        raise ValueError('Expected a specific temp directory, not a drive root')
    cutoff = time.time() - min_age_hours * 3600
    free_before = shutil.disk_usage(root).free
    result = dict(root=str(root),apply=apply,minAgeHours=min_age_hours,
                  matchedFiles=0,matchedBytes=0,eligibleFiles=0,eligibleBytes=0,
                  deletedFiles=0,deletedBytes=0,recentFiles=0,skipped=[])
    for path in root.iterdir():
        if not PATTERN.fullmatch(path.name):
            continue
        try:
            info = candidate(path, root)
            if info is None:
                result['skipped'].append({'name':path.name,'reason':'not an ordinary in-root file'})
                continue
            result['matchedFiles'] += 1
            result['matchedBytes'] += info.st_size
            if info.st_mtime > cutoff:
                result['recentFiles'] += 1
                continue
            result['eligibleFiles'] += 1
            result['eligibleBytes'] += info.st_size
            if apply:
                delete_exclusive(path, root, info, cutoff)
                result['deletedFiles'] += 1
                result['deletedBytes'] += info.st_size
        except OSError as error:
            result['skipped'].append({'name':path.name,'reason':str(error)})
    result['freeBytesBefore'] = free_before
    result['freeBytesAfter'] = shutil.disk_usage(root).free
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--apply', action='store_true', help='Delete eligible files; default is preview only')
    parser.add_argument('--min-age-hours', type=float, default=1, help='Keep recently modified files (default: 1 hour)')
    parser.add_argument('--temp-dir', default=tempfile.gettempdir(), help='Explicit temp directory; no recursive traversal')
    parser.add_argument('--report', type=Path, help='Optional JSON audit report path')
    args = parser.parse_args()
    if not 0 <= args.min_age_hours < float('inf'):
        parser.error('--min-age-hours must be finite and nonnegative')
    result = run(args.temp_dir, args.apply, args.min_age_hours)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    summary = {k:v for k,v in result.items() if k != 'skipped'}
    summary['skippedCount'] = len(result['skipped'])
    for key in ['matchedBytes','eligibleBytes','deletedBytes','freeBytesBefore','freeBytesAfter']:
        summary[key.replace('Bytes','GiB')] = round(result[key] / 2**30, 3)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
