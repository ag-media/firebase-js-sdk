/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  DocumentReference,
  _TestingHooks as TestingHooks
} from './firebase_export';

/**
 * Captures all existence filter mismatches in the Watch 'Listen' stream that
 * occur during the execution of the given code block.
 * @param callback The callback to invoke; during the invocation of this
 * callback all existence filter mismatches will be captured.
 * @return the captured existence filter mismatches and the result of awaiting
 * the given callback.
 */
export async function captureExistenceFilterMismatches<T>(
  callback: () => Promise<T>
): Promise<[ExistenceFilterMismatchInfo[], T]> {
  const results: ExistenceFilterMismatchInfo[] = [];
  const onExistenceFilterMismatchCallback = (
    info: ExistenceFilterMismatchInfoInternal
  ): void => {
    results.push(createExistenceFilterMismatchInfoFrom(info));
  };

  const unregister =
    TestingHooks.getOrCreateInstance().onExistenceFilterMismatch(
      onExistenceFilterMismatchCallback
    );

  let callbackResult: T;
  try {
    callbackResult = await callback();
  } finally {
    unregister();
  }

  return [results, callbackResult];
}

/**
 * A copy of `ExistenceFilterMismatchInfo` as defined in `testing_hooks.ts`.
 *
 * See the documentation of `TestingHooks.notifyOnExistenceFilterMismatch()`
 * for the meaning of these values.
 *
 * TODO: Delete this "interface" definition and instead use the one from
 * testing_hooks.ts. I tried to do this but couldn't figure out how to get it to
 * work in a way that survived bundling and minification.
 */
interface ExistenceFilterMismatchInfoInternal {
  localCacheCount: number;
  existenceFilterCount: number;
  projectId: string;
  databaseId: string;
  bloomFilter?: {
    applied: boolean;
    hashCount: number;
    bitmapLength: number;
    padding: number;
    mightContain?: (value: string) => boolean;
  };
}

/**
 * Information about an existence filter mismatch, captured during an invocation
 * of `captureExistenceFilterMismatches()`.
 *
 * See the documentation of `TestingHooks.notifyOnExistenceFilterMismatch()`
 * for the meaning of these values.
 */
export interface ExistenceFilterMismatchInfo {
  localCacheCount: number;
  existenceFilterCount: number;
  bloomFilter?: {
    applied: boolean;
    hashCount: number;
    bitmapLength: number;
    padding: number;
    mightContain(documentRef: DocumentReference): boolean;
  };
}

function createExistenceFilterMismatchInfoFrom(
  internalInfo: ExistenceFilterMismatchInfoInternal
): ExistenceFilterMismatchInfo {
  const info: ExistenceFilterMismatchInfo = {
    localCacheCount: internalInfo.localCacheCount,
    existenceFilterCount: internalInfo.existenceFilterCount
  };

  const internalBloomFilter = internalInfo.bloomFilter;
  if (internalBloomFilter) {
    info.bloomFilter = {
      applied: internalBloomFilter.applied,
      hashCount: internalBloomFilter.hashCount,
      bitmapLength: internalBloomFilter.bitmapLength,
      padding: internalBloomFilter.padding,
      mightContain: (documentRef: DocumentReference): boolean =>
        internalBloomFilter.mightContain?.(
          `projects/${internalInfo.projectId}` +
            `/databases/${internalInfo.databaseId}` +
            `/documents/${documentRef.path}`
        ) ?? false
    };
  }

  return info;
}
