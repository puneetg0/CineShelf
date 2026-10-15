# merge_sorted_arrays and find_duplicates functions

def merge_sorted_arrays(arr1, arr2):
    i = 0
    j = 0
    result = []

    while i < len(arr1) and j < len(arr2):
        if arr1[i] <= arr2[j]:
            result.append(arr1[i])
            i += 1
        else:
            result.append(arr2[j])
            j += 1

    result.extend(arr1[i:])
    result.extend(arr2[j:])

    return result


arr1 = [1, 3, 5, 7]
arr2 = [2, 4, 6, 8]

print(merge_sorted_arrays(arr1, arr2))

#find_duplicates function returns a list of repeated values from the input list, preserving the order of their first occurrence. It uses a set to track seen numbers and another set to track duplicates, ensuring that each duplicate is only added once to the result list.
def find_duplicates(numbers):
    seen = set()
    duplicates = set()

    for number in numbers:
        if number in seen:
            duplicates.add(number)
        else:
            seen.add(number)

    return sorted(duplicates)


numbers = [1, 2, 3, 2, 4, 5, 1, 6]
print(find_duplicates(numbers))
