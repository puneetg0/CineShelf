import unittest

from dsapractice import find_duplicates, merge_sorted_arrays


class MergeSortedArraysTests(unittest.TestCase):
    def test_merges_two_sorted_arrays(self):
        self.assertEqual(merge_sorted_arrays([1, 4, 7], [2, 3, 8]), [1, 2, 3, 4, 7, 8])

    def test_handles_empty_arrays_and_equal_values(self):
        self.assertEqual(merge_sorted_arrays([], [1, 2]), [1, 2])
        self.assertEqual(merge_sorted_arrays([1, 2], []), [1, 2])
        self.assertEqual(merge_sorted_arrays([2, 2], [2]), [2, 2, 2])


class FindDuplicatesTests(unittest.TestCase):
    def test_returns_repeated_values_once_in_first_seen_order(self):
        self.assertEqual(find_duplicates([4, 2, 4, 3, 2, 2]), [4, 2])

    def test_returns_empty_list_when_every_value_is_unique(self):
        self.assertEqual(find_duplicates([1, 2, 3]), [])

    def test_handles_empty_input(self):
        self.assertEqual(find_duplicates([]), [])


if __name__ == "__main__":
    unittest.main()
